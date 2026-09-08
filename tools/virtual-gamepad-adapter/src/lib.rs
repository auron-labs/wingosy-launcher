mod controller;
mod driver;
mod protocol;

use controller::cleanup_controller;
use controller::Controller;
#[cfg(test)]
use controller::RecordingSink;
use driver::DriverTarget;
use serde::{Deserialize, Serialize};
#[cfg(test)]
use std::cell::RefCell;
#[cfg(test)]
use std::rc::Rc;
use std::time::{Duration, Instant};

const INACTIVITY_TIMEOUT_ENV: &str = "WINGOSY_GAMEPAD_INACTIVITY_TIMEOUT_MS";
const DEFAULT_INACTIVITY_TIMEOUT_MS: u64 = 30_000;

pub use protocol::{ButtonState, DpadDirection, NormalizedState, Stick};

#[derive(Debug, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum Command {
    Connect,
    SetState { state: NormalizedState },
    Neutral,
    Status,
    Disconnect,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandName {
    Connect,
    SetState,
    Neutral,
    Status,
    Disconnect,
    Invalid,
}

#[derive(Clone, Debug, Serialize)]
pub struct Status {
    pub target: &'static str,
    pub connected: bool,
    pub ready: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_timeout: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub ok: bool,
    pub command: CommandName,
    pub status: Status,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Response {
    fn success(command: CommandName, status: Status) -> Self {
        Self {
            ok: true,
            command,
            status,
            error: None,
        }
    }

    fn failure(command: CommandName, status: Status, error: String) -> Self {
        Self {
            ok: false,
            command,
            status,
            error: Some(error),
        }
    }
}

enum ActiveController {
    Driver(Controller<DriverTarget>),
    #[cfg(test)]
    Recording(Controller<RecordingSink>),
}

impl ActiveController {
    fn set_state(&mut self, state: &NormalizedState) -> Result<(), String> {
        match self {
            Self::Driver(controller) => controller.set_state(state),
            #[cfg(test)]
            Self::Recording(controller) => controller.set_state(state),
        }
    }

    fn neutral(&mut self) -> Result<(), String> {
        match self {
            Self::Driver(controller) => controller.neutral(),
            #[cfg(test)]
            Self::Recording(controller) => controller.neutral(),
        }
    }

    fn cleanup(self) -> Result<(), CleanupError> {
        match self {
            Self::Driver(controller) => cleanup_controller(Some(controller), DriverTarget::release),
            #[cfg(test)]
            Self::Recording(controller) => cleanup_controller(Some(controller), |_| Ok(())),
        }
    }
}

pub struct Adapter {
    controller: Option<ActiveController>,
    inactivity_timeout: Duration,
    inactivity_deadline: Option<Instant>,
    last_error: Option<String>,
    last_timeout: Option<String>,
}

impl Default for Adapter {
    fn default() -> Self {
        Self::new()
    }
}

impl Adapter {
    pub fn new() -> Self {
        Self::from_timeout(Duration::from_millis(DEFAULT_INACTIVITY_TIMEOUT_MS))
            .expect("the default inactivity timeout must be valid")
    }

    pub fn from_env() -> Result<Self, String> {
        Self::from_timeout(inactivity_timeout_from_env()?)
    }

    fn from_timeout(timeout: Duration) -> Result<Self, String> {
        if timeout == Duration::ZERO {
            return Err("inactivity timeout must be greater than zero".to_owned());
        }
        if Instant::now().checked_add(timeout).is_none() {
            return Err("inactivity timeout is too large for the system clock".to_owned());
        }

        Ok(Self {
            controller: None,
            inactivity_timeout: timeout,
            inactivity_deadline: None,
            last_error: None,
            last_timeout: None,
        })
    }

    #[cfg(test)]
    fn with_timeout(timeout: Duration) -> Self {
        Self::from_timeout(timeout).expect("test timeout must be valid")
    }

    pub fn handle_line(&mut self, line: &str) -> Response {
        self.handle_line_at(line, Instant::now())
    }

    fn handle_line_at(&mut self, line: &str, now: Instant) -> Response {
        match parse_command(line) {
            Ok(command) => self.handle_command_at(command, now),
            Err(error) => self.failure(
                CommandName::Invalid,
                format!("input: invalid command JSON: {error}"),
            ),
        }
    }

    pub fn handle_command(&mut self, command: Command) -> Response {
        self.handle_command_at(command, Instant::now())
    }

    fn handle_command_at(&mut self, command: Command, now: Instant) -> Response {
        match command {
            Command::Connect => self.connect(),
            Command::SetState { state } => self.set_state(state, now),
            Command::Neutral => self.neutral(),
            Command::Status => Response::success(CommandName::Status, self.status()),
            Command::Disconnect => self.disconnect(),
        }
    }

    pub fn cleanup(&mut self) -> Result<(), CleanupError> {
        self.inactivity_deadline = None;
        match self.controller.take() {
            Some(controller) => controller.cleanup(),
            None => Ok(()),
        }
    }

    fn connect(&mut self) -> Response {
        let command = CommandName::Connect;
        if self.controller.is_some() {
            return self.failure(
                command,
                "connect: controller is already connected".to_owned(),
            );
        }

        match DriverTarget::connect() {
            Ok(target) => {
                self.controller = Some(ActiveController::Driver(Controller::new(target)));
                self.success(command)
            }
            Err(error) => self.failure(command, format!("connect: {error}")),
        }
    }

    fn set_state(&mut self, state: NormalizedState, now: Instant) -> Response {
        let command = CommandName::SetState;
        if self.controller.is_none() {
            return self.failure(command, "set_state: controller is not connected".to_owned());
        }
        let deadline = match now.checked_add(self.inactivity_timeout) {
            Some(deadline) => deadline,
            None => {
                return self.failure(
                    command,
                    "set_state: configured inactivity timeout is too large".to_owned(),
                )
            }
        };
        let result = match self.controller.as_mut() {
            Some(controller) => controller
                .set_state(&state)
                .map_err(|error| format!("set_state: {error}")),
            None => unreachable!("controller presence was checked before dispatch"),
        };

        match result {
            Ok(()) => {
                self.inactivity_deadline = Some(deadline);
                self.success(command)
            }
            Err(error) => self.failure(command, error),
        }
    }

    fn neutral(&mut self) -> Response {
        let command = CommandName::Neutral;
        self.inactivity_deadline = None;
        let result = match self.controller.as_mut() {
            Some(controller) => controller
                .neutral()
                .map_err(|error| format!("neutral: {error}")),
            None => Ok(()),
        };

        match result {
            Ok(()) => self.success(command),
            Err(error) => self.failure(command, error),
        }
    }

    pub fn service_timeout(&mut self) {
        self.service_timeout_at(Instant::now());
    }

    fn service_timeout_at(&mut self, now: Instant) {
        let Some(deadline) = self.inactivity_deadline else {
            return;
        };
        if now < deadline {
            return;
        }

        self.inactivity_deadline = None;
        let Some(controller) = self.controller.as_mut() else {
            return;
        };
        self.last_timeout = Some(match controller.neutral() {
            Ok(()) => "inactivity timeout: neutral report dispatched".to_owned(),
            Err(error) => format!("inactivity timeout: neutral report failed: {error}"),
        });
    }

    pub fn timeout_remaining(&self) -> Option<Duration> {
        self.timeout_remaining_at(Instant::now())
    }

    fn timeout_remaining_at(&self, now: Instant) -> Option<Duration> {
        self.inactivity_deadline.map(|deadline| {
            if now < deadline {
                deadline.duration_since(now)
            } else {
                Duration::ZERO
            }
        })
    }

    fn disconnect(&mut self) -> Response {
        let command = CommandName::Disconnect;
        match self.cleanup() {
            Ok(()) => self.success(command),
            Err(error) => self.failure(command, format!("disconnect: {error}")),
        }
    }

    fn status(&self) -> Status {
        Status {
            target: "x360",
            connected: self.controller.is_some(),
            ready: self.controller.is_some(),
            last_error: self.last_error.clone(),
            last_timeout: self.last_timeout.clone(),
        }
    }

    fn success(&mut self, command: CommandName) -> Response {
        self.last_error = None;
        Response::success(command, self.status())
    }

    fn failure(&mut self, command: CommandName, error: String) -> Response {
        self.last_error = Some(error.clone());
        Response::failure(command, self.status(), error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const COMPLETE_STATE_LINE: &str = r#"{"command":"set_state","state":{"buttons":{"a":true,"b":false,"x":true,"y":false,"start":true,"back":false,"guide":true,"left_thumb":false,"right_thumb":true,"left_shoulder":true,"right_shoulder":false},"dpad":"right","left_stick":{"x":__LEFT_X__,"y":1},"right_stick":{"x":1,"y":-1},"left_trigger":__LEFT_TRIGGER__,"right_trigger":1}}"#;

    fn recording_adapter() -> (Adapter, Rc<RefCell<Vec<protocol::NativeX360Report>>>) {
        recording_adapter_with_timeout(Duration::from_secs(30))
    }

    fn recording_adapter_with_timeout(
        timeout: Duration,
    ) -> (Adapter, Rc<RefCell<Vec<protocol::NativeX360Report>>>) {
        let (sink, reports) = controller::recording_sink();
        let mut adapter = Adapter::with_timeout(timeout);
        adapter.controller = Some(ActiveController::Recording(Controller::new(sink)));
        (adapter, reports)
    }

    fn set_state_line(left_x: &str, left_trigger: &str) -> String {
        COMPLETE_STATE_LINE
            .replace("__LEFT_X__", left_x)
            .replace("__LEFT_TRIGGER__", left_trigger)
    }

    fn native_report_for_set_state(line: &str) -> protocol::NativeX360Report {
        match parse_command(line).expect("test command must parse") {
            Command::SetState { state } => state.to_native_report().expect("test state is valid"),
            _ => panic!("test command must set state"),
        }
    }

    #[test]
    fn serialized_set_state_command_dispatches_expected_native_report() {
        let (mut adapter, reports) = recording_adapter();

        let response = adapter.handle_line(&set_state_line("-1", "0"));

        assert!(response.ok);
        let report = reports.borrow()[0];
        assert_eq!(
            report.buttons,
            0x1000 | 0x4000 | 0x0010 | 0x0080 | 0x0100 | 0x0400 | 0x0008
        );
        assert_eq!(report.left_trigger, 0);
        assert_eq!(report.right_trigger, 255);
        assert_eq!(report.thumb_lx, i16::MIN);
        assert_eq!(report.thumb_ly, i16::MAX);
        assert_eq!(report.thumb_rx, i16::MAX);
        assert_eq!(report.thumb_ry, i16::MIN);
    }

    #[test]
    fn serialized_invalid_state_is_rejected_before_report_dispatch() {
        let (mut adapter, reports) = recording_adapter();

        let axis_response = adapter.handle_line(&set_state_line("1.01", "0"));
        let trigger_response = adapter.handle_line(&set_state_line("0", "-0.1"));

        assert!(!axis_response.ok);
        assert!(!trigger_response.ok);
        assert!(reports.borrow().is_empty());
    }

    #[test]
    fn inactivity_timeout_neutralizes_completely_and_accepts_later_state() {
        let timeout = Duration::from_millis(100);
        let start = Instant::now();
        let (mut adapter, reports) = recording_adapter_with_timeout(timeout);
        let first_line = set_state_line("0.25", "0.5");
        let reset_line = set_state_line("-0.5", "0");
        let later_line = set_state_line("0.75", "1");
        let first_report = native_report_for_set_state(&first_line);
        let reset_report = native_report_for_set_state(&reset_line);
        let later_report = native_report_for_set_state(&later_line);

        assert!(adapter.handle_line_at(&first_line, start).ok);
        adapter.service_timeout_at(start + Duration::from_millis(99));
        assert_eq!(reports.borrow().as_slice(), &[first_report]);

        assert!(
            adapter
                .handle_line_at(&reset_line, start + Duration::from_millis(99))
                .ok
        );
        adapter.service_timeout_at(start + Duration::from_millis(198));
        assert_eq!(reports.borrow().as_slice(), &[first_report, reset_report]);

        adapter.service_timeout_at(start + Duration::from_millis(199));
        assert_eq!(
            reports.borrow().as_slice(),
            &[
                first_report,
                reset_report,
                protocol::NativeX360Report::neutral()
            ]
        );
        let status = adapter.handle_command_at(Command::Status, start + Duration::from_millis(200));
        assert!(status.ok);
        assert!(status.status.connected);
        assert!(status.status.ready);
        assert_eq!(
            status.status.last_timeout.as_deref(),
            Some("inactivity timeout: neutral report dispatched")
        );

        assert!(
            adapter
                .handle_line_at(&later_line, start + Duration::from_millis(200))
                .ok
        );
        assert_eq!(
            reports.borrow().as_slice(),
            &[
                first_report,
                reset_report,
                protocol::NativeX360Report::neutral(),
                later_report
            ]
        );
    }
}

fn inactivity_timeout_from_env() -> Result<Duration, String> {
    let value = match std::env::var(INACTIVITY_TIMEOUT_ENV) {
        Ok(value) => value,
        Err(std::env::VarError::NotPresent) => {
            return Ok(Duration::from_millis(DEFAULT_INACTIVITY_TIMEOUT_MS))
        }
        Err(std::env::VarError::NotUnicode(_)) => {
            return Err(format!(
                "{INACTIVITY_TIMEOUT_ENV} must be valid UTF-8 milliseconds"
            ))
        }
    };
    let milliseconds = value.parse::<u64>().map_err(|_| {
        format!(
            "{INACTIVITY_TIMEOUT_ENV} must be a finite positive integer number of milliseconds, got `{value}`"
        )
    })?;
    if milliseconds == 0 {
        return Err(format!(
            "{INACTIVITY_TIMEOUT_ENV} must be greater than zero milliseconds"
        ));
    }
    Ok(Duration::from_millis(milliseconds))
}

fn parse_command(line: &str) -> Result<Command, String> {
    let value: serde_json::Value = serde_json::from_str(line).map_err(|error| error.to_string())?;
    let object = value
        .as_object()
        .ok_or_else(|| "command must be a JSON object".to_owned())?;
    let command = object
        .get("command")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "command must be a string".to_owned())?;
    let allowed_keys: &[&str] = if command == "set_state" {
        &["command", "state"]
    } else {
        &["command"]
    };
    if let Some(unknown_key) = object
        .keys()
        .find(|key| !allowed_keys.contains(&key.as_str()))
    {
        return Err(format!("unknown command field `{unknown_key}`"));
    }

    serde_json::from_value(value).map_err(|error| error.to_string())
}

#[derive(Debug, PartialEq, Eq)]
pub struct CleanupError {
    pub neutral_error: Option<String>,
    pub release_error: Option<String>,
}

impl std::fmt::Display for CleanupError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match (&self.neutral_error, &self.release_error) {
            (Some(neutral), Some(release)) => write!(
                formatter,
                "neutral report failed: {neutral}; target release failed: {release}"
            ),
            (Some(neutral), None) => write!(formatter, "neutral report failed: {neutral}"),
            (None, Some(release)) => write!(formatter, "target release failed: {release}"),
            (None, None) => Ok(()),
        }
    }
}

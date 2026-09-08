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
    last_error: Option<String>,
}

impl Default for Adapter {
    fn default() -> Self {
        Self::new()
    }
}

impl Adapter {
    pub fn new() -> Self {
        Self {
            controller: None,
            last_error: None,
        }
    }

    pub fn handle_line(&mut self, line: &str) -> Response {
        match parse_command(line) {
            Ok(command) => self.handle_command(command),
            Err(error) => self.failure(
                CommandName::Invalid,
                format!("input: invalid command JSON: {error}"),
            ),
        }
    }

    pub fn handle_command(&mut self, command: Command) -> Response {
        match command {
            Command::Connect => self.connect(),
            Command::SetState { state } => self.set_state(state),
            Command::Neutral => self.neutral(),
            Command::Status => Response::success(CommandName::Status, self.status()),
            Command::Disconnect => self.disconnect(),
        }
    }

    pub fn cleanup(&mut self) -> Result<(), CleanupError> {
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

    fn set_state(&mut self, state: NormalizedState) -> Response {
        let command = CommandName::SetState;
        let result = match self.controller.as_mut() {
            Some(controller) => controller
                .set_state(&state)
                .map_err(|error| format!("set_state: {error}")),
            None => Err("set_state: controller is not connected".to_owned()),
        };

        match result {
            Ok(()) => self.success(command),
            Err(error) => self.failure(command, error),
        }
    }

    fn neutral(&mut self) -> Response {
        let command = CommandName::Neutral;
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
        let (sink, reports) = controller::recording_sink();
        let adapter = Adapter {
            controller: Some(ActiveController::Recording(Controller::new(sink))),
            last_error: None,
        };
        (adapter, reports)
    }

    fn set_state_line(left_x: &str, left_trigger: &str) -> String {
        COMPLETE_STATE_LINE
            .replace("__LEFT_X__", left_x)
            .replace("__LEFT_TRIGGER__", left_trigger)
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

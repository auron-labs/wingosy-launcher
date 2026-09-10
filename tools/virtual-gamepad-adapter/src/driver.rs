use crate::controller::ReportSink;
use crate::protocol::NativeX360Report;

#[cfg(windows)]
use std::thread;
#[cfg(windows)]
use std::time::Duration;
#[cfg(windows)]
use vigem_rust::{BusError, Client, ClientError, TargetHandle, X360Button, X360Report, Xbox360};

#[cfg(windows)]
const TARGET_READY_RETRY_ATTEMPTS: u32 = 16;
#[cfg(windows)]
const TARGET_READY_RETRY_DELAY: Duration = Duration::from_millis(2);

#[cfg(windows)]
fn dispatch_with_ready_retry(
    mut dispatch: impl FnMut() -> Result<(), ClientError>,
) -> Result<(), ClientError> {
    let mut attempts = 0u32;
    loop {
        attempts += 1;
        match dispatch() {
            Ok(()) => return Ok(()),
            Err(ClientError::Bus(BusError::TargetNotReady { .. }))
                if attempts < TARGET_READY_RETRY_ATTEMPTS =>
            {
                thread::sleep(TARGET_READY_RETRY_DELAY);
            }
            Err(error) => return Err(error),
        }
    }
}

pub(crate) struct DriverTarget {
    #[cfg(windows)]
    client: Client,
    #[cfg(windows)]
    target: TargetHandle<Xbox360>,
}

impl DriverTarget {
    #[cfg(windows)]
    pub(crate) fn connect() -> Result<Self, String> {
        let client = Client::builder()
            .max_targets(1)
            .connect()
            .map_err(|error| error.to_string())?;
        let pending = client
            .new_x360_target()
            .plug()
            .map_err(|error| format!("target plug failed: {error}"))?;

        match pending.wait_for_ready() {
            Ok(target) => Ok(Self { client, target }),
            Err(error) => {
                let unplug_error = pending
                    .unplug()
                    .err()
                    .map(|unplug_error| format!("target cleanup also failed: {unplug_error}"));
                drop(client);
                match unplug_error {
                    Some(unplug_error) => {
                        Err(format!("target readiness failed: {error}; {unplug_error}"))
                    }
                    None => Err(format!("target readiness failed: {error}")),
                }
            }
        }
    }

    #[cfg(not(windows))]
    pub(crate) fn connect() -> Result<Self, String> {
        Err("ViGEm X360 driver actions are only supported on Windows".to_owned())
    }

    #[cfg(windows)]
    pub(crate) fn release(self) -> Result<(), String> {
        let Self { client, target } = self;
        let unplug_result = target.unplug();
        drop(target);
        drop(client);
        unplug_result.map_err(|error| error.to_string())
    }

    #[cfg(not(windows))]
    pub(crate) fn release(self) -> Result<(), String> {
        Err("ViGEm X360 driver actions are only supported on Windows".to_owned())
    }
}

#[cfg(windows)]
impl ReportSink for DriverTarget {
    fn dispatch(&mut self, report: NativeX360Report) -> Result<(), String> {
        let report = X360Report {
            buttons: X360Button::from_bits_retain(report.buttons),
            left_trigger: report.left_trigger,
            right_trigger: report.right_trigger,
            thumb_lx: report.thumb_lx,
            thumb_ly: report.thumb_ly,
            thumb_rx: report.thumb_rx,
            thumb_ry: report.thumb_ry,
        };
        dispatch_with_ready_retry(|| self.target.update(&report)).map_err(|error| error.to_string())
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn retries_transient_target_not_ready_errors() {
        let attempts = Cell::new(0u32);

        let result = dispatch_with_ready_retry(|| {
            let attempt = attempts.get() + 1;
            attempts.set(attempt);
            if attempt < 3 {
                Err(ClientError::Bus(BusError::TargetNotReady { serial_no: 7 }))
            } else {
                Ok(())
            }
        });

        assert!(result.is_ok());
        assert_eq!(attempts.get(), 3);
    }

    #[test]
    fn does_not_retry_non_transient_errors() {
        let attempts = Cell::new(0u32);

        let result = dispatch_with_ready_retry(|| {
            attempts.set(attempts.get() + 1);
            Err(ClientError::TargetDoesNotExist { serial_no: 7 })
        });

        assert!(matches!(
            result,
            Err(ClientError::TargetDoesNotExist { serial_no: 7 })
        ));
        assert_eq!(attempts.get(), 1);
    }
}

#[cfg(not(windows))]
impl ReportSink for DriverTarget {
    fn dispatch(&mut self, _report: NativeX360Report) -> Result<(), String> {
        Err("ViGEm X360 driver actions are only supported on Windows".to_owned())
    }
}

use crate::controller::ReportSink;
use crate::protocol::NativeX360Report;

#[cfg(windows)]
use vigem_rust::{Client, TargetHandle, X360Button, X360Report, Xbox360};

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
        self.target
            .update(&report)
            .map_err(|error| error.to_string())
    }
}

#[cfg(not(windows))]
impl ReportSink for DriverTarget {
    fn dispatch(&mut self, _report: NativeX360Report) -> Result<(), String> {
        Err("ViGEm X360 driver actions are only supported on Windows".to_owned())
    }
}

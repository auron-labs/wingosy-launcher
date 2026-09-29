use crate::controller::ReportSink;
use crate::protocol::NativeX360Report;

#[cfg(windows)]
use crate::protocol::{
    A, B, BACK, DPAD_DOWN, DPAD_LEFT, DPAD_RIGHT, DPAD_UP, GUIDE, LEFT_SHOULDER, LEFT_THUMB,
    RIGHT_SHOULDER, RIGHT_THUMB, START, X, Y,
};
#[cfg(windows)]
use hidmaestro::{Buttons, GamepadState, Hat, HidMaestro, StandardAxes};

#[cfg(windows)]
const CONTROLLER_PROFILE_ID: &str = "xbox-360-wired";

#[cfg(windows)]
fn report_to_gamepad_state(report: NativeX360Report) -> GamepadState {
    let mut buttons = Buttons::NONE;
    let native = report.buttons;
    for (native_bit, button) in [
        (START, Buttons::START),
        (BACK, Buttons::BACK),
        (LEFT_THUMB, Buttons::LEFT_STICK),
        (RIGHT_THUMB, Buttons::RIGHT_STICK),
        (LEFT_SHOULDER, Buttons::LEFT_BUMPER),
        (RIGHT_SHOULDER, Buttons::RIGHT_BUMPER),
        (GUIDE, Buttons::GUIDE),
        (A, Buttons::A),
        (B, Buttons::B),
        (X, Buttons::X),
        (Y, Buttons::Y),
    ] {
        if native & native_bit != 0 {
            buttons |= button;
        }
    }

    let up = native & DPAD_UP != 0;
    let down = native & DPAD_DOWN != 0;
    let left = native & DPAD_LEFT != 0;
    let right = native & DPAD_RIGHT != 0;
    let hat = match (up, down, left, right) {
        (true, false, false, false) => Hat::North,
        (true, false, false, true) => Hat::NorthEast,
        (false, false, false, true) => Hat::East,
        (false, true, false, true) => Hat::SouthEast,
        (false, true, false, false) => Hat::South,
        (false, true, true, false) => Hat::SouthWest,
        (false, false, true, false) => Hat::West,
        (true, false, true, false) => Hat::NorthWest,
        _ => Hat::None,
    };

    // HIDMaestro axes are 0.0..=1.0 with 0.5 centered; HID Y runs
    // down-positive, so the positive-up X360 thumb range is mirrored.
    let stick_axis = |value: i16| 0.5 + f32::from(value) / 65536.0;
    let stick_axis_inverted = |value: i16| 0.5 - f32::from(value) / 65536.0;

    GamepadState {
        buttons,
        hat,
        standard_axes: Some(StandardAxes {
            left_stick_x: Some(stick_axis(report.thumb_lx)),
            left_stick_y: Some(stick_axis_inverted(report.thumb_ly)),
            right_stick_x: Some(stick_axis(report.thumb_rx)),
            right_stick_y: Some(stick_axis_inverted(report.thumb_ry)),
            left_trigger: Some(f32::from(report.left_trigger) / 255.0),
            right_trigger: Some(f32::from(report.right_trigger) / 255.0),
        }),
        ..Default::default()
    }
}

pub(crate) struct DriverTarget {
    #[cfg(windows)]
    session: HidMaestro,
    #[cfg(windows)]
    key: String,
}

impl DriverTarget {
    #[cfg(windows)]
    pub(crate) fn connect() -> Result<Self, String> {
        let mut session = HidMaestro::spawn().map_err(|error| error.to_string())?;
        if !session
            .is_driver_installed()
            .map_err(|error| error.to_string())?
        {
            session
                .install_driver()
                .map_err(|error| format!("driver install failed: {error}"))?;
        }
        session
            .load_default_profiles()
            .map_err(|error| format!("profile load failed: {error}"))?;
        let key = session
            .create_controller(CONTROLLER_PROFILE_ID, None)
            .map_err(|error| format!("controller creation failed: {error}"))?;
        Ok(Self { session, key })
    }

    #[cfg(not(windows))]
    pub(crate) fn connect() -> Result<Self, String> {
        Err("HIDMaestro driver actions are only supported on Windows".to_owned())
    }

    #[cfg(windows)]
    pub(crate) fn release(mut self) -> Result<(), String> {
        let remove_result = self
            .session
            .remove_controller(&self.key)
            .map_err(|error| error.to_string());
        self.session.shutdown();
        remove_result
    }

    #[cfg(not(windows))]
    pub(crate) fn release(self) -> Result<(), String> {
        Err("HIDMaestro driver actions are only supported on Windows".to_owned())
    }
}

#[cfg(windows)]
impl ReportSink for DriverTarget {
    fn dispatch(&mut self, report: NativeX360Report) -> Result<(), String> {
        self.session
            .submit_state(&self.key, &report_to_gamepad_state(report))
            .map_err(|error| error.to_string())
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    fn report(buttons: u16) -> NativeX360Report {
        NativeX360Report {
            buttons,
            ..NativeX360Report::neutral()
        }
    }

    fn standard_axes(state: &GamepadState) -> StandardAxes {
        state
            .standard_axes
            .expect("report conversion must produce canonical axes")
    }

    #[test]
    fn full_state_maps_to_gamepad_state() {
        let report = NativeX360Report {
            buttons: A | X | START | RIGHT_THUMB | LEFT_SHOULDER | GUIDE | DPAD_RIGHT,
            left_trigger: 0,
            right_trigger: 255,
            thumb_lx: i16::MIN,
            thumb_ly: i16::MAX,
            thumb_rx: i16::MAX,
            thumb_ry: i16::MIN,
        };

        let state = report_to_gamepad_state(report);

        assert!(state.buttons.contains(Buttons::A));
        assert!(state.buttons.contains(Buttons::X));
        assert!(state.buttons.contains(Buttons::START));
        assert!(state.buttons.contains(Buttons::RIGHT_STICK));
        assert!(state.buttons.contains(Buttons::LEFT_BUMPER));
        assert!(state.buttons.contains(Buttons::GUIDE));
        assert!(!state.buttons.contains(Buttons::B));
        assert_eq!(state.hat, Hat::East);

        let axes = standard_axes(&state);
        assert_eq!(axes.left_stick_x, Some(0.0));
        assert_eq!(axes.left_stick_y, Some(0.5 - 32767.0 / 65536.0));
        assert_eq!(axes.right_stick_x, Some(0.5 + 32767.0 / 65536.0));
        assert_eq!(axes.right_stick_y, Some(1.0));
        assert_eq!(axes.left_trigger, Some(0.0));
        assert_eq!(axes.right_trigger, Some(1.0));
    }

    #[test]
    fn neutral_report_maps_to_centered_gamepad_state() {
        let state = report_to_gamepad_state(NativeX360Report::neutral());

        assert_eq!(state.buttons, Buttons::NONE);
        assert_eq!(state.hat, Hat::None);
        let axes = standard_axes(&state);
        assert_eq!(axes.left_stick_x, Some(0.5));
        assert_eq!(axes.left_stick_y, Some(0.5));
        assert_eq!(axes.right_stick_x, Some(0.5));
        assert_eq!(axes.right_stick_y, Some(0.5));
        assert_eq!(axes.left_trigger, Some(0.0));
        assert_eq!(axes.right_trigger, Some(0.0));
    }

    #[test]
    fn dpad_octants_map_to_hat_directions() {
        for (bits, expected) in [
            (DPAD_UP, Hat::North),
            (DPAD_UP | DPAD_RIGHT, Hat::NorthEast),
            (DPAD_RIGHT, Hat::East),
            (DPAD_DOWN | DPAD_RIGHT, Hat::SouthEast),
            (DPAD_DOWN, Hat::South),
            (DPAD_DOWN | DPAD_LEFT, Hat::SouthWest),
            (DPAD_LEFT, Hat::West),
            (DPAD_UP | DPAD_LEFT, Hat::NorthWest),
            (0, Hat::None),
            (DPAD_UP | DPAD_DOWN, Hat::None),
        ] {
            assert_eq!(report_to_gamepad_state(report(bits)).hat, expected);
        }
    }
}

#[cfg(not(windows))]
impl ReportSink for DriverTarget {
    fn dispatch(&mut self, _report: NativeX360Report) -> Result<(), String> {
        Err("HIDMaestro driver actions are only supported on Windows".to_owned())
    }
}

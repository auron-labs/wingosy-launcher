use serde::Deserialize;

const DPAD_UP: u16 = 0x0001;
const DPAD_DOWN: u16 = 0x0002;
const DPAD_LEFT: u16 = 0x0004;
const DPAD_RIGHT: u16 = 0x0008;
const START: u16 = 0x0010;
const BACK: u16 = 0x0020;
const LEFT_THUMB: u16 = 0x0040;
const RIGHT_THUMB: u16 = 0x0080;
const LEFT_SHOULDER: u16 = 0x0100;
const RIGHT_SHOULDER: u16 = 0x0200;
const GUIDE: u16 = 0x0400;
const A: u16 = 0x1000;
const B: u16 = 0x2000;
const X: u16 = 0x4000;
const Y: u16 = 0x8000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct NormalizedState {
    pub buttons: ButtonState,
    pub dpad: DpadDirection,
    pub left_stick: Stick,
    pub right_stick: Stick,
    pub left_trigger: f64,
    pub right_trigger: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ButtonState {
    pub a: bool,
    pub b: bool,
    pub x: bool,
    pub y: bool,
    pub start: bool,
    pub back: bool,
    pub guide: bool,
    pub left_thumb: bool,
    pub right_thumb: bool,
    pub left_shoulder: bool,
    pub right_shoulder: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Stick {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DpadDirection {
    Neutral,
    Up,
    Down,
    Left,
    Right,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(crate) struct NativeX360Report {
    pub buttons: u16,
    pub left_trigger: u8,
    pub right_trigger: u8,
    pub thumb_lx: i16,
    pub thumb_ly: i16,
    pub thumb_rx: i16,
    pub thumb_ry: i16,
}

impl NativeX360Report {
    pub(crate) const fn neutral() -> Self {
        Self {
            buttons: 0,
            left_trigger: 0,
            right_trigger: 0,
            thumb_lx: 0,
            thumb_ly: 0,
            thumb_rx: 0,
            thumb_ry: 0,
        }
    }
}

impl NormalizedState {
    pub(crate) fn to_native_report(&self) -> Result<NativeX360Report, String> {
        validate_axis("left_stick.x", self.left_stick.x)?;
        validate_axis("left_stick.y", self.left_stick.y)?;
        validate_axis("right_stick.x", self.right_stick.x)?;
        validate_axis("right_stick.y", self.right_stick.y)?;
        validate_trigger("left_trigger", self.left_trigger)?;
        validate_trigger("right_trigger", self.right_trigger)?;

        let mut buttons = 0;
        set_button(&mut buttons, START, self.buttons.start);
        set_button(&mut buttons, BACK, self.buttons.back);
        set_button(&mut buttons, LEFT_THUMB, self.buttons.left_thumb);
        set_button(&mut buttons, RIGHT_THUMB, self.buttons.right_thumb);
        set_button(&mut buttons, LEFT_SHOULDER, self.buttons.left_shoulder);
        set_button(&mut buttons, RIGHT_SHOULDER, self.buttons.right_shoulder);
        set_button(&mut buttons, GUIDE, self.buttons.guide);
        set_button(&mut buttons, A, self.buttons.a);
        set_button(&mut buttons, B, self.buttons.b);
        set_button(&mut buttons, X, self.buttons.x);
        set_button(&mut buttons, Y, self.buttons.y);
        buttons |= dpad_bits(self.dpad);

        Ok(NativeX360Report {
            buttons,
            left_trigger: trigger_to_native(self.left_trigger),
            right_trigger: trigger_to_native(self.right_trigger),
            thumb_lx: axis_to_native(self.left_stick.x),
            thumb_ly: axis_to_native(self.left_stick.y),
            thumb_rx: axis_to_native(self.right_stick.x),
            thumb_ry: axis_to_native(self.right_stick.y),
        })
    }
}

fn set_button(buttons: &mut u16, bit: u16, pressed: bool) {
    if pressed {
        *buttons |= bit;
    }
}

fn dpad_bits(direction: DpadDirection) -> u16 {
    match direction {
        DpadDirection::Neutral => 0,
        DpadDirection::Up => DPAD_UP,
        DpadDirection::Down => DPAD_DOWN,
        DpadDirection::Left => DPAD_LEFT,
        DpadDirection::Right => DPAD_RIGHT,
    }
}

fn validate_axis(name: &str, value: f64) -> Result<(), String> {
    if !value.is_finite() {
        return Err(format!("{name} must be finite, got {value:?}"));
    }
    if !(-1.0..=1.0).contains(&value) {
        return Err(format!("{name} must be in [-1, 1], got {value}"));
    }
    Ok(())
}

fn validate_trigger(name: &str, value: f64) -> Result<(), String> {
    if !value.is_finite() {
        return Err(format!("{name} must be finite, got {value:?}"));
    }
    if !(0.0..=1.0).contains(&value) {
        return Err(format!("{name} must be in [0, 1], got {value}"));
    }
    Ok(())
}

fn axis_to_native(value: f64) -> i16 {
    if value < 0.0 {
        (value * 32768.0).round() as i16
    } else {
        (value * 32767.0).round() as i16
    }
}

fn trigger_to_native(value: f64) -> u8 {
    (value * 255.0).round() as u8
}

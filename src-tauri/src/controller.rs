use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

pub const EDEN_PROFILE_NAME: &str = "Wingosy";

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ControllerConfig {
    #[serde(default)]
    pub mappings: BTreeMap<String, ControllerMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ControllerMapping {
    pub name: String,
    #[serde(default)]
    pub controls: BTreeMap<String, PhysicalInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PhysicalInput {
    Button {
        index: u8,
    },
    Axis {
        index: u8,
        #[serde(default)]
        inverted: bool,
        #[serde(default, skip_serializing_if = "AxisDirection::is_full")]
        direction: AxisDirection,
    },
    Hat {
        index: u8,
        direction: HatDirection,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum HatDirection {
    Up,
    Right,
    Down,
    Left,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AxisDirection {
    #[default]
    Full,
    Positive,
    Negative,
}

impl AxisDirection {
    fn is_full(&self) -> bool {
        *self == Self::Full
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeController {
    pub device_id: u32,
    pub name: String,
    pub guid: String,
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CapturedController {
    pub guid: String,
    pub mapping: ControllerMapping,
}

#[derive(Debug, Clone)]
struct DiscoveredController {
    device_id: u32,
    name: String,
    guid: String,
    port: u32,
    mapping: ControllerMapping,
}

const REQUIRED_CONTROLS: &[&str] = &[
    "face_a",
    "face_b",
    "face_x",
    "face_y",
    "left_shoulder",
    "right_shoulder",
    "left_stick_click",
    "right_stick_click",
    "start",
    "select",
    "guide",
    "dpad_up",
    "dpad_down",
    "dpad_left",
    "dpad_right",
    "left_trigger",
    "right_trigger",
    "left_stick_x",
    "left_stick_y",
    "right_stick_x",
    "right_stick_y",
];

const EDEN_BUTTON_CONTROLS: &[(&str, &str)] = &[
    ("button_a", "face_b"),
    ("button_b", "face_a"),
    ("button_x", "face_y"),
    ("button_y", "face_x"),
    ("button_l", "left_shoulder"),
    ("button_r", "right_shoulder"),
    ("button_lstick", "left_stick_click"),
    ("button_rstick", "right_stick_click"),
    ("button_plus", "start"),
    ("button_minus", "select"),
    ("button_home", "guide"),
    ("button_dup", "dpad_up"),
    ("button_ddown", "dpad_down"),
    ("button_dleft", "dpad_left"),
    ("button_dright", "dpad_right"),
    ("button_zl", "left_trigger"),
    ("button_zr", "right_trigger"),
];

const EDEN_ANALOG_CONTROLS: &[(&str, &str, &str)] = &[
    ("lstick", "left_stick_x", "left_stick_y"),
    ("rstick", "right_stick_x", "right_stick_y"),
];

pub fn normalize_sdl_guid(raw: &str) -> Result<String> {
    let compact: String = raw
        .chars()
        .filter(|character| !character.is_ascii_whitespace() && *character != '-')
        .collect();
    if compact.len() != 32
        || !compact
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        bail!("SDL GUID must contain exactly 32 hexadecimal characters")
    }

    let mut normalized = compact.to_ascii_lowercase().into_bytes();
    normalized[4..8].fill(b'0');
    String::from_utf8(normalized).context("normalized SDL GUID was not valid UTF-8")
}

pub fn parse_sdl_mapping(name: impl Into<String>, mapping: &str) -> Result<ControllerMapping> {
    let fields = split_sdl_mapping_fields(mapping);
    if fields.len() < 2 {
        bail!("SDL returned an invalid gamepad mapping")
    }

    let mut controls = BTreeMap::new();
    for field in fields.iter().skip(2) {
        let Some((key, value)) = field.split_once(':') else {
            continue;
        };
        let Some(control) = sdl_control_name(key) else {
            continue;
        };
        let input = parse_sdl_input(value)
            .with_context(|| format!("invalid SDL binding for {key}: {value}"))?;
        controls.insert(control.to_string(), input);
    }

    let missing: Vec<_> = REQUIRED_CONTROLS
        .iter()
        .filter(|control| !controls.contains_key(**control))
        .copied()
        .collect();
    if !missing.is_empty() {
        bail!(
            "SDL mapping is missing standard controls: {}",
            missing.join(", ")
        )
    }

    Ok(ControllerMapping {
        name: name.into(),
        controls,
    })
}

pub fn serialize_eden_profile(
    guid: &str,
    port: u32,
    mapping: &ControllerMapping,
) -> Result<String> {
    let guid = normalize_sdl_guid(guid)?;
    let mut lines = vec!["[Controls]".to_string()];

    for (eden_name, control_name) in EDEN_BUTTON_CONTROLS {
        let input = mapping
            .controls
            .get(*control_name)
            .with_context(|| format!("controller mapping is missing {control_name}"))?;
        push_eden_setting(
            &mut lines,
            eden_name,
            serialize_eden_button_input(&guid, port, input)?,
        );
    }

    for (eden_name, x_name, y_name) in EDEN_ANALOG_CONTROLS {
        let x = mapping
            .controls
            .get(*x_name)
            .with_context(|| format!("controller mapping is missing {x_name}"))?;
        let y = mapping
            .controls
            .get(*y_name)
            .with_context(|| format!("controller mapping is missing {y_name}"))?;
        let x = axis_input(x).with_context(|| format!("{x_name} is not an SDL axis"))?;
        let y = axis_input(y).with_context(|| format!("{y_name} is not an SDL axis"))?;
        push_eden_setting(
            &mut lines,
            eden_name,
            format!(
                "engine:sdl,port:{port},guid:{guid},axis_x:{},axis_y:{},offset_x:0,offset_y:0,invert_x:{},invert_y:{}",
                x.index,
                y.index,
                if x.inverted { '-' } else { '+' },
                if y.inverted { '-' } else { '+' },
            ),
        );
    }

    Ok(format!("{}\n", lines.join("\n")))
}

pub fn write_eden_profile(path: &Path, contents: &str) -> Result<()> {
    let parent = path
        .parent()
        .context("Eden profile path has no parent directory")?;
    std::fs::create_dir_all(parent).context("failed to create Eden input profile directory")?;

    let artifact_id = format!(
        "{}-{}",
        std::process::id(),
        PROFILE_ARTIFACT_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    );
    let temporary = profile_artifact_path(path, "tmp", &artifact_id)?;
    let backup = profile_artifact_path(path, "bak", &artifact_id)?;

    if let Err(error) = std::fs::write(&temporary, contents) {
        let _ = std::fs::remove_file(&temporary);
        return Err(error).context("failed to stage Eden input profile");
    }

    let had_previous_profile = path.exists();
    if had_previous_profile {
        if let Err(error) = std::fs::rename(path, &backup) {
            let _ = std::fs::remove_file(&temporary);
            return Err(error).context("failed to stage the prior Wingosy Eden profile");
        }
    }

    if let Err(error) = std::fs::rename(&temporary, path) {
        let rollback = if had_previous_profile {
            std::fs::rename(&backup, path).err()
        } else {
            None
        };
        let _ = std::fs::remove_file(&temporary);
        return match rollback {
            Some(rollback_error) => Err(anyhow::anyhow!(
                "failed to install Wingosy Eden profile: {error}; failed to restore the prior profile: {rollback_error}"
            )),
            None => Err(error).context("failed to install Wingosy Eden profile"),
        };
    }

    if had_previous_profile {
        std::fs::remove_file(&backup).context("failed to clean the prior Wingosy Eden profile")?;
    }
    Ok(())
}

static PROFILE_ARTIFACT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn profile_artifact_path(path: &Path, kind: &str, artifact_id: &str) -> Result<PathBuf> {
    let parent = path
        .parent()
        .context("Eden profile path has no parent directory")?;
    let file_name = path
        .file_name()
        .context("Eden profile path has no file name")?
        .to_string_lossy();
    Ok(parent.join(format!(".{file_name}.{kind}-{artifact_id}")))
}

pub fn list_native_controllers(config: &ControllerConfig) -> Result<Vec<NativeController>> {
    discover_controllers()?
        .into_iter()
        .map(|controller| {
            Ok(NativeController {
                device_id: controller.device_id,
                name: controller.name,
                configured: config.mappings.contains_key(&controller.guid),
                guid: controller.guid,
            })
        })
        .collect()
}

pub fn capture_native_controller(device_id: u32) -> Result<CapturedController> {
    let controller = discover_controllers()?
        .into_iter()
        .find(|controller| controller.device_id == device_id)
        .with_context(|| format!("native controller {device_id} is no longer connected"))?;
    Ok(CapturedController {
        guid: controller.guid,
        mapping: controller.mapping,
    })
}

pub fn prepare_eden_profile(
    config: &ControllerConfig,
    executable: &Path,
) -> Result<Option<PathBuf>> {
    let controllers = discover_controllers()?;
    let Some(contents) = prepare_eden_profile_contents(&controllers, config)? else {
        return Ok(None);
    };
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    let root = crate::bios::eden_data_root(executable, appdata.as_deref())?;
    let path = root.join("input").join(format!("{EDEN_PROFILE_NAME}.ini"));
    write_eden_profile(&path, &contents)?;
    Ok(Some(path))
}

const EDEN_CONTROLS_SECTION: &str = "[Controls]";
const EDEN_NAVIGATION_KEY: &str = "controller_navigation";
const EDEN_NAVIGATION_DEFAULT_KEY: &str = "controller_navigation\\default";
const EDEN_NAVIGATION_DEFAULT_LINE: &str = "controller_navigation\\default=false";
const EDEN_NAVIGATION_LINE: &str = "controller_navigation=true";
const EDEN_PLAYER_TYPE_KEY: &str = "player_1_type";
// DualJoyconDetached: emits the controller-navigation keys Eden's dialogs
// listen for while keeping a full button map; ProController emits none.
const EDEN_PLAYER_TYPE_LINE: &str = "player_1_type=1";

/// Enables Eden's controller-driven UI navigation so gamepad input reaches
/// its dialogs (for example the exit confirmation). The player-1 controller
/// type is set only when Eden has never recorded one, so an explicit user
/// choice is preserved; a Handheld type would additionally force docked mode
/// off, which is why the value is never overwritten.
pub fn ensure_eden_controller_navigation(executable: &Path) -> Result<()> {
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    let root = crate::bios::eden_data_root(executable, appdata.as_deref())?;
    let ini_path = root.join("config").join("qt-config.ini");
    let contents = match std::fs::read_to_string(&ini_path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => {
            return Err(error)
                .with_context(|| format!("Failed to read Eden config {}", ini_path.display()))
        }
    };
    let updated = update_eden_qsettings_controls(&contents);
    if updated == contents {
        return Ok(());
    }
    write_eden_profile(&ini_path, &updated)
}

fn update_eden_qsettings_controls(contents: &str) -> String {
    let line_ending = if contents.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let lines = contents
        .split('\n')
        .map(|line| line.strip_suffix('\r').unwrap_or(line).to_string())
        .collect::<Vec<_>>();
    let mut section_start = None;
    let mut section_end = lines.len();
    let mut in_section = false;
    for (index, line) in lines.iter().enumerate() {
        if line.starts_with('[') && line.ends_with(']') {
            if in_section {
                section_end = index;
                break;
            }
            in_section = line == EDEN_CONTROLS_SECTION;
            if in_section {
                section_start = Some(index);
            }
        }
    }
    let Some(section_start) = section_start else {
        let mut result = contents.to_string();
        if !result.is_empty() && !result.ends_with(line_ending) {
            result.push_str(line_ending);
        }
        result.push_str(EDEN_CONTROLS_SECTION);
        result.push_str(line_ending);
        result.push_str(EDEN_NAVIGATION_DEFAULT_LINE);
        result.push_str(line_ending);
        result.push_str(EDEN_NAVIGATION_LINE);
        result.push_str(line_ending);
        result.push_str(EDEN_PLAYER_TYPE_LINE);
        return result;
    };
    let mut navigation_line = None;
    let mut navigation_default_line = None;
    let mut player_type_line = None;
    for (index, line) in lines
        .iter()
        .enumerate()
        .take(section_end)
        .skip(section_start + 1)
    {
        let Some((key, _value)) = line.split_once('=') else {
            continue;
        };
        if key == EDEN_NAVIGATION_KEY {
            navigation_line = Some(index);
        } else if key == EDEN_NAVIGATION_DEFAULT_KEY {
            navigation_default_line = Some(index);
        } else if key == EDEN_PLAYER_TYPE_KEY {
            player_type_line = Some(index);
        }
    }
    let mut tail: Vec<&'static str> = Vec::new();
    if navigation_line.is_none() && navigation_default_line.is_none() {
        tail.push(EDEN_NAVIGATION_DEFAULT_LINE);
        tail.push(EDEN_NAVIGATION_LINE);
    }
    if player_type_line.is_none() {
        tail.push(EDEN_PLAYER_TYPE_LINE);
    }
    let mut output = Vec::with_capacity(lines.len() + 3);
    for (index, line) in lines.iter().enumerate() {
        if index == section_end {
            output.extend(tail.iter().map(|value| (*value).to_string()));
        }
        if Some(index) == navigation_line {
            if navigation_default_line.is_none() {
                output.push(EDEN_NAVIGATION_DEFAULT_LINE.to_string());
            }
            output.push(EDEN_NAVIGATION_LINE.to_string());
            continue;
        }
        if Some(index) == navigation_default_line {
            output.push(EDEN_NAVIGATION_DEFAULT_LINE.to_string());
            if navigation_line.is_none() {
                output.push(EDEN_NAVIGATION_LINE.to_string());
            }
            continue;
        }
        output.push(line.clone());
    }
    if section_end == lines.len() {
        output.extend(tail.iter().map(|value| (*value).to_string()));
    }
    output.join(line_ending)
}

fn prepare_eden_profile_contents(
    controllers: &[DiscoveredController],
    config: &ControllerConfig,
) -> Result<Option<String>> {
    let Some(controller) = controllers
        .iter()
        .find(|controller| config.mappings.contains_key(&controller.guid))
    else {
        return Ok(None);
    };
    let mapping = config
        .mappings
        .get(&controller.guid)
        .context("configured controller mapping disappeared")?;
    Ok(Some(serialize_eden_profile(
        &controller.guid,
        controller.port,
        mapping,
    )?))
}

fn sdl_control_name(key: &str) -> Option<&'static str> {
    Some(match key {
        "a" => "face_a",
        "b" => "face_b",
        "x" => "face_x",
        "y" => "face_y",
        "leftshoulder" => "left_shoulder",
        "rightshoulder" => "right_shoulder",
        "leftstick" => "left_stick_click",
        "rightstick" => "right_stick_click",
        "start" => "start",
        "back" => "select",
        "guide" => "guide",
        "dpup" => "dpad_up",
        "dpdown" => "dpad_down",
        "dpleft" => "dpad_left",
        "dpright" => "dpad_right",
        "lefttrigger" => "left_trigger",
        "righttrigger" => "right_trigger",
        "leftx" => "left_stick_x",
        "lefty" => "left_stick_y",
        "rightx" => "right_stick_x",
        "righty" => "right_stick_y",
        _ => return None,
    })
}

fn parse_sdl_input(value: &str) -> Result<PhysicalInput> {
    let mut value = value;
    let mut inverted = false;
    if value.starts_with('~') {
        inverted = true;
        value = &value[1..];
    }
    if value.ends_with('~') {
        inverted = true;
        value = &value[..value.len() - 1];
    }
    let axis_direction = if value.starts_with('+') {
        value = &value[1..];
        AxisDirection::Positive
    } else if value.starts_with('-') {
        value = &value[1..];
        AxisDirection::Negative
    } else {
        AxisDirection::Full
    };

    if let Some(index) = value.strip_prefix('b') {
        return Ok(PhysicalInput::Button {
            index: parse_index(index)?,
        });
    }
    if let Some(index) = value.strip_prefix('a') {
        return Ok(PhysicalInput::Axis {
            index: parse_index(index)?,
            inverted,
            direction: axis_direction,
        });
    }
    if let Some(value) = value.strip_prefix('h') {
        let (index, mask) = value
            .split_once('.')
            .context("hat binding has no direction mask")?;
        let direction = match mask {
            "1" => HatDirection::Up,
            "2" => HatDirection::Right,
            "4" => HatDirection::Down,
            "8" => HatDirection::Left,
            _ => bail!("unsupported SDL hat direction mask {mask}"),
        };
        return Ok(PhysicalInput::Hat {
            index: parse_index(index)?,
            direction,
        });
    }

    bail!("unsupported SDL binding")
}

fn parse_index(value: &str) -> Result<u8> {
    value
        .parse::<u8>()
        .with_context(|| format!("invalid SDL input index {value}"))
}

fn axis_input(input: &PhysicalInput) -> Option<AxisInput> {
    match input {
        PhysicalInput::Axis {
            index,
            inverted,
            direction: AxisDirection::Full,
        } => Some(AxisInput {
            index: *index,
            inverted: *inverted,
        }),
        _ => None,
    }
}

#[derive(Debug, Clone, Copy)]
struct AxisInput {
    index: u8,
    inverted: bool,
}

fn serialize_eden_button_input(guid: &str, port: u32, input: &PhysicalInput) -> Result<String> {
    Ok(match input {
        PhysicalInput::Button { index } => {
            format!("engine:sdl,port:{port},guid:{guid},button:{index}")
        }
        PhysicalInput::Axis {
            index,
            inverted,
            direction,
        } => format!(
            "engine:sdl,port:{port},guid:{guid},axis:{index},threshold:0.5,invert:{}",
            axis_direction_marker(*direction, *inverted),
        ),
        PhysicalInput::Hat { index, direction } => format!(
            "engine:sdl,port:{port},guid:{guid},hat:{index},direction:{}",
            hat_direction_name(direction)
        ),
    })
}

fn axis_direction_marker(direction: AxisDirection, inverted: bool) -> char {
    match direction {
        AxisDirection::Positive => '+',
        AxisDirection::Negative => '-',
        AxisDirection::Full if inverted => '-',
        AxisDirection::Full => '+',
    }
}

fn push_eden_setting(lines: &mut Vec<String>, key: &str, value: String) {
    lines.push(format!("{key}\\default=false"));
    lines.push(format!("{key}={}", adjust_eden_output_string(&value)));
}

fn adjust_eden_output_string(value: &str) -> String {
    if value.contains(',') {
        format!("\"{value}\"")
    } else {
        value.to_string()
    }
}

fn hat_direction_name(direction: &HatDirection) -> &'static str {
    match direction {
        HatDirection::Up => "up",
        HatDirection::Right => "right",
        HatDirection::Down => "down",
        HatDirection::Left => "left",
    }
}

fn split_sdl_mapping_fields(mapping: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut escaped = false;
    for character in mapping.chars() {
        if escaped {
            current.push(character);
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == ',' {
            fields.push(std::mem::take(&mut current));
        } else {
            current.push(character);
        }
    }
    if escaped {
        current.push('\\');
    }
    fields.push(current);
    fields
}

#[cfg(windows)]
fn discover_controllers() -> Result<Vec<DiscoveredController>> {
    sdl3::hint::set("SDL_JOYSTICK_THREAD", "1");
    let sdl = sdl3::init().context("failed to initialize SDL")?;
    let gamepads = sdl
        .gamepad()
        .context("failed to initialize SDL gamepad support")?;
    let mut ports = BTreeMap::<String, u32>::new();
    let mut discovered = Vec::new();

    for device_id in gamepads
        .gamepads()
        .context("failed to enumerate SDL gamepads")?
    {
        let guid = normalize_sdl_guid(&gamepads.guid_for_id(device_id).string())?;
        let gamepad = gamepads
            .open(device_id)
            .with_context(|| format!("failed to open SDL gamepad {device_id}"))?;
        let name = gamepad
            .name()
            .unwrap_or_else(|| "Unnamed controller".to_string());
        let mapping = gamepad
            .mapping()
            .with_context(|| format!("SDL has no standard mapping for {name}"))?;
        let mapping = parse_sdl_mapping(name.clone(), &mapping)?;
        let port = ports.entry(guid.clone()).or_insert(0);
        let controller = DiscoveredController {
            device_id: device_id.raw(),
            name,
            guid,
            port: *port,
            mapping,
        };
        *port += 1;
        discovered.push(controller);
    }

    Ok(discovered)
}

#[cfg(not(windows))]
fn discover_controllers() -> Result<Vec<DiscoveredController>> {
    bail!("native SDL controller discovery is only available in the Windows packaged application")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn standard_mapping() -> &'static str {
        "000000005e0400008e02000000000000,Test Pad,a:b0,b:b1,x:b2,y:b3,leftshoulder:b4,rightshoulder:b5,back:b6,guide:b7,start:b8,leftstick:b9,rightstick:b10,dpup:h0.1,dpdown:h0.4,dpleft:h0.8,dpright:h0.2,leftx:a0,lefty:a1,rightx:a2,righty:a3,lefttrigger:a4,righttrigger:a5"
    }

    #[test]
    fn normalizes_sdl_guid_and_clears_controller_name_crc() {
        assert_eq!(
            normalize_sdl_guid("000000005E0400008E02000000000000").unwrap(),
            "000000005e0400008e02000000000000"
        );
        assert_eq!(
            normalize_sdl_guid("03000000-5e04-0000-8e02-000000000000").unwrap(),
            "030000005e0400008e02000000000000"
        );
    }

    #[test]
    fn parses_standard_sdl_mapping_into_emulator_neutral_controls() {
        let mapping = parse_sdl_mapping("Test Pad", standard_mapping()).unwrap();
        assert_eq!(mapping.name, "Test Pad");
        assert_eq!(
            mapping.controls.get("face_a"),
            Some(&PhysicalInput::Button { index: 0 })
        );
        assert_eq!(
            mapping.controls.get("dpad_left"),
            Some(&PhysicalInput::Hat {
                index: 0,
                direction: HatDirection::Left,
            })
        );
        assert_eq!(
            mapping.controls.get("right_trigger"),
            Some(&PhysicalInput::Axis {
                index: 5,
                inverted: false,
                direction: AxisDirection::Full,
            })
        );
    }

    #[test]
    fn parses_sdl_half_axis_direction_without_losing_full_axis_inversion() {
        let mapping = standard_mapping()
            .replace("lefttrigger:a4", "lefttrigger:+a4")
            .replace("righttrigger:a5", "righttrigger:-a5")
            .replace("leftx:a0", "leftx:~a0");
        let mapping = parse_sdl_mapping("Half Axis Pad", &mapping).unwrap();

        assert_eq!(
            mapping.controls.get("left_trigger"),
            Some(&PhysicalInput::Axis {
                index: 4,
                inverted: false,
                direction: AxisDirection::Positive,
            })
        );
        assert_eq!(
            mapping.controls.get("right_trigger"),
            Some(&PhysicalInput::Axis {
                index: 5,
                inverted: false,
                direction: AxisDirection::Negative,
            })
        );
        assert_eq!(
            mapping.controls.get("left_stick_x"),
            Some(&PhysicalInput::Axis {
                index: 0,
                inverted: true,
                direction: AxisDirection::Full,
            })
        );
    }

    #[test]
    fn persists_mappings_by_normalized_guid_without_cross_model_inheritance() {
        let mapping = parse_sdl_mapping("Test Pad", standard_mapping()).unwrap();
        let guid = normalize_sdl_guid("000000005e0400008e02000000000000").unwrap();
        let other_guid = normalize_sdl_guid("000000006e0400008e02000000000000").unwrap();
        let config = ControllerConfig {
            mappings: BTreeMap::from([(guid.clone(), mapping)]),
        };

        let serialized = toml::to_string(&config).unwrap();
        let restored: ControllerConfig = toml::from_str(&serialized).unwrap();

        assert!(restored.mappings.contains_key(&guid));
        assert!(!restored.mappings.contains_key(&other_guid));
    }

    #[test]
    fn serializes_eden_profile_with_current_runtime_port() {
        let mapping = parse_sdl_mapping("Test Pad", standard_mapping()).unwrap();
        let profile =
            serialize_eden_profile("000000005e0400008e02000000000000", 2, &mapping).unwrap();
        assert!(profile.contains("[Controls]"));
        assert!(profile
            .contains("button_a\\default=false\nbutton_a=\"engine:sdl,port:2,guid:000000005e0400008e02000000000000,button:1\""));
        assert!(profile
            .contains("button_b\\default=false\nbutton_b=\"engine:sdl,port:2,guid:000000005e0400008e02000000000000,button:0\""));
        assert!(profile
            .contains("button_x\\default=false\nbutton_x=\"engine:sdl,port:2,guid:000000005e0400008e02000000000000,button:3\""));
        assert!(profile
            .contains("button_y\\default=false\nbutton_y=\"engine:sdl,port:2,guid:000000005e0400008e02000000000000,button:2\""));
        assert!(profile.contains(
            "button_home\\default=false\nbutton_home=\"engine:sdl,port:2,guid:000000005e0400008e02000000000000,button:7\""
        ));
        assert!(profile.contains("button_zr\\default=false\nbutton_zr=\"engine:sdl,port:2,guid:000000005e0400008e02000000000000,axis:5,threshold:0.5,invert:+\""));
        assert!(profile.contains("lstick\\default=false\nlstick=\"engine:sdl,port:2,guid:000000005e0400008e02000000000000,axis_x:0,axis_y:1,offset_x:0,offset_y:0,invert_x:+,invert_y:+\""));
    }

    #[test]
    fn serializes_half_axis_triggers_and_rejects_half_axis_sticks() {
        let trigger_mapping = standard_mapping()
            .replace("lefttrigger:a4", "lefttrigger:+a4")
            .replace("righttrigger:a5", "righttrigger:-a5");
        let trigger_mapping = parse_sdl_mapping("Half Axis Pad", &trigger_mapping).unwrap();
        let profile =
            serialize_eden_profile("000000005e0400008e02000000000000", 1, &trigger_mapping)
                .unwrap();

        assert!(profile.contains("button_zl\\default=false\nbutton_zl=\"engine:sdl,port:1,guid:000000005e0400008e02000000000000,axis:4,threshold:0.5,invert:+\""));
        assert!(profile.contains("button_zr\\default=false\nbutton_zr=\"engine:sdl,port:1,guid:000000005e0400008e02000000000000,axis:5,threshold:0.5,invert:-\""));

        let stick_mapping = standard_mapping().replace("leftx:a0", "leftx:+a0");
        let stick_mapping = parse_sdl_mapping("Half Axis Stick", &stick_mapping).unwrap();
        assert!(
            serialize_eden_profile("000000005e0400008e02000000000000", 1, &stick_mapping,).is_err()
        );
    }

    #[test]
    fn profile_replacement_preserves_unrelated_files() {
        let directory = tempfile::tempdir().unwrap();
        let input = directory.path().join("input");
        std::fs::create_dir_all(&input).unwrap();
        let user_profile = input.join("User.ini");
        std::fs::write(&user_profile, "user data").unwrap();
        let wingosy = input.join("Wingosy.ini");

        write_eden_profile(&wingosy, "new data").unwrap();
        write_eden_profile(&wingosy, "updated data").unwrap();

        assert_eq!(std::fs::read_to_string(&user_profile).unwrap(), "user data");
        assert_eq!(std::fs::read_to_string(&wingosy).unwrap(), "updated data");

        let mut entries = std::fs::read_dir(&input)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        entries.sort();
        assert_eq!(entries, vec!["User.ini", "Wingosy.ini"]);
    }

    #[test]
    fn reconnecting_guid_uses_new_runtime_port_and_other_guid_is_ignored() {
        let mapping = parse_sdl_mapping("Test Pad", standard_mapping()).unwrap();
        let guid = normalize_sdl_guid("03000000-5e04-0000-8e02-000000000000").unwrap();
        let other_guid = normalize_sdl_guid("03000000-6e04-0000-8e02-000000000000").unwrap();
        let config = ControllerConfig {
            mappings: BTreeMap::from([(guid.clone(), mapping.clone())]),
        };
        let reconnected = DiscoveredController {
            device_id: 42,
            name: "Reconnected Pad".to_string(),
            guid: guid.clone(),
            port: 3,
            mapping,
        };

        let profile = prepare_eden_profile_contents(&[reconnected], &config)
            .unwrap()
            .unwrap();
        assert!(profile.contains(&format!("port:3,guid:{guid}")));

        let different_model = DiscoveredController {
            device_id: 43,
            name: "Different Pad".to_string(),
            guid: other_guid,
            port: 3,
            mapping: parse_sdl_mapping("Different Pad", standard_mapping()).unwrap(),
        };
        assert!(prepare_eden_profile_contents(&[different_model], &config)
            .unwrap()
            .is_none());
    }

    #[test]
    fn eden_controls_insertion_creates_section_and_sets_navigation() {
        let updated = update_eden_qsettings_controls("[General]\nuse_docked_mode=true\n");
        assert_eq!(
            updated,
            "[General]\nuse_docked_mode=true\n[Controls]\ncontroller_navigation\\default=false\ncontroller_navigation=true\nplayer_1_type=1"
        );
    }

    #[test]
    fn eden_controls_update_enables_navigation_and_seeds_player_type() {
        let updated =
            update_eden_qsettings_controls("[Controls]\nbutton_a=\"engine:sdl\"\n[Paths]\nx=1\n");
        assert_eq!(
            updated,
            "[Controls]\nbutton_a=\"engine:sdl\"\ncontroller_navigation\\default=false\ncontroller_navigation=true\nplayer_1_type=1\n[Paths]\nx=1\n"
        );
    }

    #[test]
    fn eden_controls_update_flips_disabled_navigation_and_keeps_player_type() {
        let updated = update_eden_qsettings_controls(
            "[Controls]\ncontroller_navigation\\default=false\ncontroller_navigation=false\nplayer_1_type=0\n",
        );
        assert_eq!(
            updated,
            "[Controls]\ncontroller_navigation\\default=false\ncontroller_navigation=true\nplayer_1_type=0\n"
        );
    }

    #[test]
    fn eden_controls_update_is_idempotent() {
        let updated = update_eden_qsettings_controls(
            "[Controls]\ncontroller_navigation\\default=false\ncontroller_navigation=true\nplayer_1_type=1\n",
        );
        assert_eq!(
            updated,
            "[Controls]\ncontroller_navigation\\default=false\ncontroller_navigation=true\nplayer_1_type=1\n"
        );
        assert_eq!(update_eden_qsettings_controls(&updated), updated);
    }
}

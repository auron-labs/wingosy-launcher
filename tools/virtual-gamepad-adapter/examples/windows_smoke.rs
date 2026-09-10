#[cfg(windows)]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use std::thread::sleep;
    use std::time::Duration;
    use wingosy_virtual_gamepad_adapter::{
        Adapter, ButtonState, Command, DpadDirection, NormalizedState, Response, Stick,
    };

    fn state(a: bool, dpad: DpadDirection) -> NormalizedState {
        NormalizedState {
            buttons: ButtonState {
                a,
                b: false,
                x: false,
                y: false,
                start: false,
                back: false,
                guide: false,
                left_thumb: false,
                right_thumb: false,
                left_shoulder: false,
                right_shoulder: false,
            },
            dpad,
            left_stick: Stick { x: 0.0, y: 0.0 },
            right_stick: Stick { x: 0.0, y: 0.0 },
            left_trigger: 0.0,
            right_trigger: 0.0,
        }
    }

    fn require_ok(response: Response, operation: &str) -> Result<(), std::io::Error> {
        if response.ok {
            Ok(())
        } else {
            Err(std::io::Error::other(format!(
                "{operation} failed: {}",
                response.error.as_deref().unwrap_or("unknown adapter error")
            )))
        }
    }

    let mut adapter = Adapter::new();
    require_ok(adapter.handle_command(Command::Connect), "connect")?;
    let pause = Duration::from_millis(150);

    require_ok(
        adapter.handle_command(Command::SetState {
            state: state(true, DpadDirection::Neutral),
        }),
        "A press",
    )?;
    sleep(pause);

    require_ok(
        adapter.handle_command(Command::SetState {
            state: state(false, DpadDirection::Neutral),
        }),
        "A release",
    )?;
    sleep(pause);

    require_ok(
        adapter.handle_command(Command::SetState {
            state: state(false, DpadDirection::Up),
        }),
        "D-pad up press",
    )?;
    sleep(pause);

    require_ok(
        adapter.handle_command(Command::SetState {
            state: state(false, DpadDirection::Neutral),
        }),
        "D-pad up release",
    )?;
    sleep(pause);

    require_ok(adapter.handle_command(Command::Neutral), "neutral")?;
    require_ok(adapter.handle_command(Command::Disconnect), "disconnect")?;
    Ok(())
}

#[cfg(not(windows))]
fn main() {
    eprintln!("windows_smoke is an opt-in real-driver check and only runs on Windows");
}

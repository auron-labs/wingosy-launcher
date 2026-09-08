#[cfg(windows)]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use std::thread::sleep;
    use std::time::Duration;
    use vigem_rust::{Client, X360Button, X360Report};

    let client = Client::builder().max_targets(1).connect()?;
    let pending = client.new_x360_target().plug()?;
    let target = pending.wait_for_ready()?;
    let pause = Duration::from_millis(150);

    let mut report = X360Report::default();
    report.buttons.insert(X360Button::A);
    target.update(&report)?;
    sleep(pause);

    report.buttons.remove(X360Button::A);
    target.update(&report)?;
    sleep(pause);

    report.buttons.insert(X360Button::DPAD_UP);
    target.update(&report)?;
    sleep(pause);

    report.buttons.remove(X360Button::DPAD_UP);
    target.update(&report)?;
    sleep(pause);

    target.update(&X360Report::default())?;
    target.unplug()?;
    drop(client);
    Ok(())
}

#[cfg(not(windows))]
fn main() {
    eprintln!("windows_smoke is an opt-in real-driver check and only runs on Windows");
}

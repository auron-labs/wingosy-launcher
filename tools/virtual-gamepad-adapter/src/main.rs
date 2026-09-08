use std::io::{self, BufRead, Write};

use wingosy_virtual_gamepad_adapter::Adapter;

fn main() {
    if let Err(error) = run() {
        eprintln!("adapter process failed: {error}");
        std::process::exit(1);
    }
}

fn run() -> io::Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::BufWriter::new(io::stdout().lock());
    let mut adapter = Adapter::new();

    for line in stdin.lock().lines() {
        let line = line?;
        let response = adapter.handle_line(&line);
        serde_json::to_writer(&mut stdout, &response)
            .map_err(|error| io::Error::other(format!("serialize response: {error}")))?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }

    if let Err(error) = adapter.cleanup() {
        eprintln!("EOF cleanup failed: {error}");
    }

    Ok(())
}

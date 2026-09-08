use std::io::{self, BufRead, Write};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;

use wingosy_virtual_gamepad_adapter::Adapter;

fn main() {
    if let Err(error) = run() {
        eprintln!("adapter process failed: {error}");
        std::process::exit(1);
    }
}

fn run() -> io::Result<()> {
    let mut stdout = io::BufWriter::new(io::stdout().lock());
    let mut adapter = Adapter::from_env().map_err(io::Error::other)?;
    let input = spawn_stdin_reader();

    let result = process_input(&mut adapter, &mut stdout, &input);

    if let Err(error) = adapter.cleanup() {
        eprintln!("EOF cleanup failed: {error}");
    }

    result
}

fn spawn_stdin_reader() -> Receiver<io::Result<String>> {
    let (sender, receiver) = mpsc::channel();
    let _reader = thread::spawn(move || {
        for line in io::stdin().lock().lines() {
            if sender.send(line).is_err() {
                break;
            }
        }
    });
    receiver
}

fn process_input(
    adapter: &mut Adapter,
    stdout: &mut io::BufWriter<io::StdoutLock<'_>>,
    input: &Receiver<io::Result<String>>,
) -> io::Result<()> {
    loop {
        adapter.service_timeout();
        let line = match adapter.timeout_remaining() {
            Some(wait) => match input.recv_timeout(wait) {
                Ok(line) => line,
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => return Ok(()),
            },
            None => match input.recv() {
                Ok(line) => line,
                Err(_) => return Ok(()),
            },
        }?;

        adapter.service_timeout();
        let response = adapter.handle_line(&line);
        serde_json::to_writer(&mut *stdout, &response)
            .map_err(|error| io::Error::other(format!("serialize response: {error}")))?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }
}

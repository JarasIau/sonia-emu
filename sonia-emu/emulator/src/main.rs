use std::io::{BufReader, Read};
use std::os::unix::net::UnixListener;
use std::{env, error};

mod joystick;

fn main() -> Result<(), Box<dyn error::Error>> {
    let joystick = joystick::Joystick::new()?;
    let args: Vec<_> = env::args().collect();
    let path = if args.len() > 1 {
        &args[1]
    } else {
        "/tmp/sonia-emu.sock"
    };

    println!(
        "Created joystick with device path {}",
        joystick.device_path()?.to_string_lossy()
    );

    let _ = std::fs::remove_file(path);
    let listener = UnixListener::bind(path)?;
    println!("Listening at {}", path);

    loop {
        match listener.accept() {
            Ok((socket, _)) => {
                println!("Client connected!");
                if let Err(e) = handle_client(socket, &joystick) {
                    eprintln!("Client error: {}", e);
                }
                println!("Client disconnected");
            }
            Err(e) => {
                eprintln!("Accept error: {}", e);
                break;
            }
        }
    }

    Ok(())
}

#[inline]
fn handle_client(
    socket: std::os::unix::net::UnixStream,
    joystick: &joystick::Joystick,
) -> Result<(), Box<dyn error::Error>> {
    let mut buffer = [0u8; 6];
    let mut reader = BufReader::with_capacity(4096, socket);

    loop {
        match reader.read_exact(&mut buffer) {
            Ok(_) => {
                let value = i32::from_be_bytes([buffer[2], buffer[3], buffer[4], buffer[5]]);
                let handled = match buffer[0] {
                    b'b' => match BUTTON_MAP.get(buffer[1] as usize).copied() {
                        Some(button) => {
                            joystick.button_press(button, value != 0)?;
                            true
                        }
                        None => false,
                    },
                    b'j' => match AXIS_MAP.get(buffer[1] as usize).copied() {
                        Some(axis) => {
                            joystick.move_axis(axis, value)?;
                            true
                        }
                        None => false,
                    },
                    _ => false,
                };

                if handled {
                    joystick.synchronise()?;
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(Box::new(e)),
        }
    }

    Ok(())
}

const BUTTON_MAP: [joystick::Button; 17] = {
    use joystick::Button::*;
    [
        LeftNorth,
        LeftEast,
        LeftWest,
        LeftSouth,
        LeftSpecial,
        RightSouth,
        RightSpecial,
        RightEast,
        RightNorth,
        RightWest,
        R2,
        R1,
        L2,
        L1,
        R3,
        L3,
        Guide,
    ]
};

const AXIS_MAP: [joystick::Axis; 6] = {
    use joystick::Axis::*;
    [X, Y, RX, RY, Z, RZ]
};

use std::io::{BufReader, Read};
use std::os::unix::net::UnixListener;
use std::{env, error};

mod joystick;
mod utils;

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
                if let Some(packet) = utils::packet::Packet::from_bytes(buffer) {
                    let mut handled = false;

                    match packet.prefix {
                        b'b' => {
                            if let Some(button) = button_map(packet.input_id) {
                                joystick.button_press(button, packet.value != 0)?;
                                handled = true;
                            }
                        }
                        b'j' => {
                            if let Some(axis) = axis_map(packet.input_id) {
                                joystick.move_axis(axis, packet.value)?;
                                handled = true;
                            }
                        }
                        _ => {}
                    }

                    if handled {
                        joystick.synchronise()?;
                    }
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

#[inline(always)]
fn button_map(i: u8) -> Option<joystick::Button> {
    BUTTON_MAP.get(i as usize).copied()
}

#[inline(always)]
fn axis_map(i: u8) -> Option<joystick::Axis> {
    AXIS_MAP.get(i as usize).copied()
}

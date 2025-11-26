use serde::{Deserialize, Serialize};
use tokio::{io::{AsyncReadExt}, net::TcpStream};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerPingResult {
    pub online: bool,
    pub latency: u64, // milliseconds
}

async fn read_varint(stream: &mut TcpStream) -> std::io::Result<i32> {
    let mut result = 0;
    let mut shift = 0;
    
    loop {
        let mut byte = [0u8; 1];
        stream.read_exact(&mut byte).await?;
        let value = byte[0];
        
        result |= ((value & 0x7F) as i32) << shift;
        
        if (value & 0x80) == 0 {
            break;
        }
        
        shift += 7;
        if shift >= 32 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "VarInt too big",
            ));
        }
    }
    
    Ok(result)
}

pub async fn try_ping_async(address: &str, port: u16) -> std::io::Result<u64> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio::time::{timeout, Duration};

    // Connect with timeout
    let mut stream = timeout(
        Duration::from_secs(3),
        TcpStream::connect(format!("{}:{}", address, port)),
    )
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "Timeout"))??;

    // ----- Build handshake -----
    let protocol_version = 765;

    let mut handshake = Vec::new();

    handshake.push(0x00); // packet id

    handshake.extend(encode_varint(protocol_version)); // protocol
    handshake.extend(encode_varint(address.len() as i32)); // host length
    handshake.extend(address.as_bytes()); // host
    handshake.extend(&port.to_be_bytes()); // port
    handshake.extend(encode_varint(1)); // next state = status

    // write handshake length + handshake
    let len = encode_varint(handshake.len() as i32);
    stream.write_all(&len).await?;
    stream.write_all(&handshake).await?;

    // ----- Request status -----
    stream.write_all(&[0x01, 0x00]).await?;

    // ----- Read status -----
    let _packet_len = read_varint(&mut stream).await?;
    let packet_id = read_varint(&mut stream).await?;
    if packet_id != 0x00 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Bad packet"));
    }

    let json_len = read_varint(&mut stream).await? as usize;
    let mut json_buf = vec![0; json_len];
    stream.read_exact(&mut json_buf).await?;

    // ----- Ping -----
    let start = std::time::Instant::now();
    let payload = start.elapsed().as_nanos() as i64;

    let mut ping = Vec::new();
    ping.extend(encode_varint(0x01)); // packet id
    ping.extend(payload.to_be_bytes());

    let len = encode_varint(ping.len() as i32);
    stream.write_all(&len).await?;
    stream.write_all(&ping).await?;

    // ----- Read pong -----
    let _pong_len = read_varint(&mut stream).await?;
    let pong_id = read_varint(&mut stream).await?;
    if pong_id != 0x01 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Bad pong"));
    }

    let mut pong = [0u8; 8];
    stream.read_exact(&mut pong).await?;

    Ok(start.elapsed().as_millis() as u64)
}

// Helper function to encode varint without async
fn encode_varint(mut value: i32) -> Vec<u8> {
    let mut bytes = Vec::new();
    loop {
        let mut temp = (value & 0x7F) as u8;
        value >>= 7;
        if value != 0 {
            temp |= 0x80;
        }
        bytes.push(temp);
        if value == 0 {
            break;
        }
    }
    bytes
}
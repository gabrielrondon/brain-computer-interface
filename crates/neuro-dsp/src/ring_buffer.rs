//! High-performance circular ring buffer for real-time time-series streaming.
//!
//! Provides zero-allocation insertion and contiguous window extraction
//! for multi-channel biological signal processing.

#[derive(Debug, Clone)]
pub struct RingBuffer {
    buffer: Vec<f32>,
    capacity: usize,
    write_pos: usize,
    total_samples: u64,
}

impl RingBuffer {
    /// Creates a new circular buffer with the specified fixed capacity.
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "Capacity must be greater than zero");
        Self {
            buffer: vec![0.0; capacity],
            capacity,
            write_pos: 0,
            total_samples: 0,
        }
    }

    /// Appends a single sample to the buffer, overwriting the oldest sample if full.
    #[inline(always)]
    pub fn push(&mut self, sample: f32) {
        self.buffer[self.write_pos] = sample;
        self.write_pos = (self.write_pos + 1) % self.capacity;
        self.total_samples += 1;
    }

    /// Appends a slice of samples to the buffer in chronological order.
    pub fn push_slice(&mut self, samples: &[f32]) {
        for &sample in samples {
            self.push(sample);
        }
    }

    /// Extracts the latest `n` samples into `destination` in chronological order.
    /// Returns the number of samples actually written (up to destination.len() and capacity).
    pub fn get_latest(&self, n: usize, destination: &mut [f32]) -> usize {
        let count = n.min(self.capacity).min(destination.len());
        if count == 0 {
            return 0;
        }

        // Calculate start index in circular array
        let start = if self.write_pos >= count {
            self.write_pos - count
        } else {
            self.capacity + self.write_pos - count
        };

        for i in 0..count {
            let idx = (start + i) % self.capacity;
            destination[i] = self.buffer[idx];
        }

        count
    }

    /// Returns the total number of samples pushed into this buffer over its lifetime.
    pub fn total_samples(&self) -> u64 {
        self.total_samples
    }

    /// Returns the allocated capacity.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Resets all values in the buffer to zero and rewinds the write head.
    pub fn clear(&mut self) {
        self.buffer.fill(0.0);
        self.write_pos = 0;
        self.total_samples = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_push_and_extract() {
        let mut rb = RingBuffer::new(5);
        for i in 1..=5 {
            rb.push(i as f32);
        }

        let mut out = vec![0.0; 5];
        let count = rb.get_latest(5, &mut out);
        assert_eq!(count, 5);
        assert_eq!(out, vec![1.0, 2.0, 3.0, 4.0, 5.0]);

        // Push 2 more samples: should overwrite 1.0 and 2.0
        rb.push(6.0);
        rb.push(7.0);

        let mut out2 = vec![0.0; 5];
        rb.get_latest(5, &mut out2);
        assert_eq!(out2, vec![3.0, 4.0, 5.0, 6.0, 7.0]);

        // Extract partial window
        let mut out3 = vec![0.0; 3];
        rb.get_latest(3, &mut out3);
        assert_eq!(out3, vec![5.0, 6.0, 7.0]);
    }
}

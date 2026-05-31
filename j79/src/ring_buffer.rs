use crate::error::{GatewayError, Result};
use parking_lot::{Condvar, Mutex};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DataPoint {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub device_id: String,
    pub register: u16,
    pub value: i32,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum OverflowStrategy {
    Block,
    DropOldest,
    DropNewest,
}

impl Default for OverflowStrategy {
    fn default() -> Self {
        OverflowStrategy::Block
    }
}

struct BufferInner<T> {
    data: Vec<Option<T>>,
    head: usize,
    tail: usize,
    count: usize,
}

pub struct RingBuffer<T> {
    inner: Mutex<BufferInner<T>>,
    not_empty: Condvar,
    not_full: Condvar,
    capacity: usize,
    overflow_strategy: OverflowStrategy,
    tx_count: AtomicUsize,
    rx_count: AtomicUsize,
    overflow_count: AtomicUsize,
}

impl<T: Clone + Send> RingBuffer<T> {
    pub fn new(capacity: usize) -> Arc<Self> {
        Self::with_strategy(capacity, OverflowStrategy::default())
    }

    pub fn with_strategy(capacity: usize, strategy: OverflowStrategy) -> Arc<Self> {
        let mut data = Vec::with_capacity(capacity);
        for _ in 0..capacity {
            data.push(None);
        }

        Arc::new(Self {
            inner: Mutex::new(BufferInner {
                data,
                head: 0,
                tail: 0,
                count: 0,
            }),
            not_empty: Condvar::new(),
            not_full: Condvar::new(),
            capacity,
            overflow_strategy: strategy,
            tx_count: AtomicUsize::new(0),
            rx_count: AtomicUsize::new(0),
            overflow_count: AtomicUsize::new(0),
        })
    }

    pub fn set_overflow_strategy(&self, _strategy: OverflowStrategy) {
        // Note: This method is a placeholder.
        // Changing strategy at runtime would require interior mutability for overflow_strategy
        // which is not implemented for performance reasons.
        // Create a new RingBuffer with the desired strategy instead.
    }

    pub fn push(&self, item: T) -> Result<()> {
        let mut inner = self.inner.lock();

        match self.overflow_strategy {
            OverflowStrategy::Block => {
                while inner.count == self.capacity {
                    self.not_full.wait(&mut inner);
                }
                self.push_internal(&mut inner, item);
            }
            OverflowStrategy::DropOldest => {
                if inner.count == self.capacity {
                    self.drop_oldest_internal(&mut inner);
                }
                self.push_internal(&mut inner, item);
            }
            OverflowStrategy::DropNewest => {
                if inner.count == self.capacity {
                    self.overflow_count.fetch_add(1, Ordering::Relaxed);
                    return Ok(());
                }
                self.push_internal(&mut inner, item);
            }
        }

        Ok(())
    }

    fn push_internal(&self, inner: &mut BufferInner<T>, item: T) {
        let head = inner.head;
        inner.data[head] = Some(item);
        inner.head = (inner.head + 1) % self.capacity;
        inner.count += 1;

        self.tx_count.fetch_add(1, Ordering::Relaxed);
        self.not_empty.notify_one();
    }

    fn drop_oldest_internal(&self, inner: &mut BufferInner<T>) {
        let tail = inner.tail;
        inner.data[tail].take();
        inner.tail = (inner.tail + 1) % self.capacity;
        inner.count -= 1;
        self.overflow_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn try_push(&self, item: T) -> Result<()> {
        let mut inner = self.inner.try_lock().ok_or(GatewayError::Other(
            "Failed to acquire lock for push".into(),
        ))?;

        if inner.count == self.capacity {
            match self.overflow_strategy {
                OverflowStrategy::Block => {
                    return Err(GatewayError::BufferFull);
                }
                OverflowStrategy::DropOldest => {
                    self.drop_oldest_internal(&mut inner);
                }
                OverflowStrategy::DropNewest => {
                    self.overflow_count.fetch_add(1, Ordering::Relaxed);
                    return Ok(());
                }
            }
        }

        self.push_internal(&mut inner, item);
        Ok(())
    }

    pub fn pop(&self) -> Result<T> {
        let mut inner = self.inner.lock();

        while inner.count == 0 {
            self.not_empty.wait(&mut inner);
        }

        let tail = inner.tail;
        let item = inner.data[tail]
            .take()
            .ok_or(GatewayError::BufferEmpty)?;
        inner.tail = (inner.tail + 1) % self.capacity;
        inner.count -= 1;

        self.rx_count.fetch_add(1, Ordering::Relaxed);
        self.not_full.notify_one();

        Ok(item)
    }

    pub fn try_pop(&self) -> Result<T> {
        let mut inner = self.inner.try_lock().ok_or(GatewayError::Other(
            "Failed to acquire lock for pop".into(),
        ))?;

        if inner.count == 0 {
            return Err(GatewayError::BufferEmpty);
        }

        let tail = inner.tail;
        let item = inner.data[tail]
            .take()
            .ok_or(GatewayError::BufferEmpty)?;
        inner.tail = (inner.tail + 1) % self.capacity;
        inner.count -= 1;

        self.rx_count.fetch_add(1, Ordering::Relaxed);
        self.not_full.notify_one();

        Ok(item)
    }

    pub fn pop_batch(&self, max_batch: usize, timeout: std::time::Duration) -> Result<Vec<T>> {
        let mut inner = self.inner.lock();

        if inner.count == 0 {
            let result = self.not_empty.wait_for(&mut inner, timeout);
            if result.timed_out() || inner.count == 0 {
                return Err(GatewayError::BufferEmpty);
            }
        }

        let batch_size = std::cmp::min(inner.count, max_batch);
        let mut batch = Vec::with_capacity(batch_size);

        for _ in 0..batch_size {
            let tail = inner.tail;
            if let Some(item) = inner.data[tail].take() {
                batch.push(item);
                inner.tail = (inner.tail + 1) % self.capacity;
                inner.count -= 1;
            }
        }

        self.rx_count.fetch_add(batch.len(), Ordering::Relaxed);
        self.not_full.notify_all();

        Ok(batch)
    }

    pub fn len(&self) -> usize {
        self.inner.lock().count
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn stats(&self) -> BufferStats {
        BufferStats {
            len: self.len(),
            capacity: self.capacity,
            tx_count: self.tx_count.load(Ordering::Relaxed),
            rx_count: self.rx_count.load(Ordering::Relaxed),
            overflow_count: self.overflow_count.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct BufferStats {
    pub len: usize,
    pub capacity: usize,
    pub tx_count: usize,
    pub rx_count: usize,
    pub overflow_count: usize,
}

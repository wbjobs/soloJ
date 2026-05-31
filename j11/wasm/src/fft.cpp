#include "fft.h"
#include <numeric>

namespace audioproc {

FFT::FFT(size_t size) : size_(size) {
    log2_size_ = 0;
    while ((1u << log2_size_) < size_) ++log2_size_;
    if ((1u << log2_size_) != size_) {
        throw std::invalid_argument("FFT size must be a power of 2");
    }
    buildTwiddleFactors();
    buildBitReverseTable();
}

void FFT::buildTwiddleFactors() {
    twiddle_.resize(size_);
    double angle = -2.0 * M_PI / static_cast<double>(size_);
    for (size_t i = 0; i < size_; ++i) {
        double a = angle * static_cast<double>(i);
        twiddle_[i] = Complex(std::cos(a), std::sin(a));
    }
}

void FFT::buildBitReverseTable() {
    bit_rev_.resize(size_);
    for (size_t i = 0; i < size_; ++i) {
        size_t rev = 0;
        size_t val = i;
        for (size_t j = 0; j < log2_size_; ++j) {
            rev = (rev << 1) | (val & 1);
            val >>= 1;
        }
        bit_rev_[i] = rev;
    }
}

void FFT::transform(std::vector<Complex>& data, bool inverse) const {
    if (data.size() != size_) {
        data.resize(size_, Complex(0, 0));
    }

    for (size_t i = 0; i < size_; ++i) {
        if (i < bit_rev_[i]) {
            std::swap(data[i], data[bit_rev_[i]]);
        }
    }

    double sign = inverse ? 1.0 : -1.0;
    double angle = sign * M_PI;

    for (size_t len = 2; len <= size_; len <<= 1) {
        double wlen_real = std::cos(angle);
        double wlen_imag = std::sin(angle);
        for (size_t i = 0; i < size_; i += len) {
            Complex w(1.0, 0.0);
            size_t half = len >> 1;
            for (size_t j = 0; j < half; ++j) {
                Complex u = data[i + j];
                Complex v = data[i + j + half] * w;
                data[i + j] = u + v;
                data[i + j + half] = u - v;
                Complex w_next;
                w_next.real(w.real() * wlen_real - w.imag() * wlen_imag);
                w_next.imag(w.real() * wlen_imag + w.imag() * wlen_real);
                w = w_next;
            }
        }
        angle *= 0.5;
    }

    if (inverse) {
        double inv = 1.0 / static_cast<double>(size_);
        for (auto& c : data) {
            c *= inv;
        }
    }
}

void FFT::forward(std::vector<Complex>& data) const {
    transform(data, false);
}

void FFT::inverse(std::vector<Complex>& data) const {
    transform(data, true);
}

std::vector<double> FFT::magnitudeSpectrum(const std::vector<double>& signal) const {
    std::vector<Complex> cdata(signal.begin(), signal.end());
    transform(cdata, false);
    size_t half = size_ / 2 + 1;
    std::vector<double> mag(half);
    for (size_t i = 0; i < half; ++i) {
        mag[i] = std::abs(cdata[i]);
    }
    return mag;
}

std::vector<double> FFT::magnitudeSpectrumFromComplex(const std::vector<Complex>& data) const {
    std::vector<Complex> cdata = data;
    transform(cdata, false);
    size_t half = size_ / 2 + 1;
    std::vector<double> mag(half);
    for (size_t i = 0; i < half; ++i) {
        mag[i] = std::abs(cdata[i]);
    }
    return mag;
}

} // namespace audioproc

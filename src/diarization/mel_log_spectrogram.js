const audioContext = new AudioContext();
const filterLength = 1024;
const hopLength = 256;
const winLength = 1024;
const nMelChannels = 80;
const samplingRate = 22050;
const melFmin = 0;
const melFmax = 8000.0;
const maxWavValue = 32768.0;
const minLogValue = -11.52;
const maxLogValue = 1.2;
const silenceThresholdDb = -10;

const frameSize = 512;
const hopSize = 256;

function melFilterbank(nfilt, nfft, sampleRate, melFmin, melFmax) {
    const lowfreq = melFmin;
    const highfreq = melFmax;
    const melpoints = linspace(0, (2595 * Math.log10(1 + highfreq / 700)), nfilt + 2);
    const bin = Math.floor((nfft + 1) * mel2hz(melpoints) / sampleRate);

    const fbank = Array.from({length: nfilt}, (_, i) => {
        const start = bin[i];
        const center = bin[i + 1];
        const end = bin[i + 2];
        const result = Array.from({length: nfft}, (_, j) => {
            if (j < start) {
                return 0;
            } else if (j >= start && j <= center) {
                return (j - start) / (center - start);
            } else if (j > center && j <= end) {
                return (end - j) / (end - center);
            } else {
                return 0;
            }
        });
        return result;
    });

    return fbank;
}

function linspace(start, end, num) {
    const step = (end - start) / (num - 1);
    return Array.from({length: num}, (_, i) => start + i * step);
}

function mel2hz(mel) {
    return 700 * (10 ** (mel / 2595) - 1);
}


// // Calculate mel filterbank (wrong shape)
// function melFilterbank(nMelChannels, filterLength, samplingRate, melFmin, melFmax) {
//     const nFft = filterLength;
//     const fftFreqs = Array.from({length: nFft / 2 + 1}, (_, i) => i * samplingRate / nFft);
//     const melMin = 1125.0 * Math.log(1 + melFmin / 700.0);
//     const melMax = 1125.0 * Math.log(1 + melFmax / 700.0);
//     const melPoints = Array.from({length: nMelChannels + 2}, (_, i) => melMin + i * (melMax - melMin) / (nMelChannels + 1));
//     const bin = melPoints.map(melPoint => Math.floor((filterLength + 1) * 700.0 * (Math.exp(melPoint / 1125.0) - 1) / samplingRate));
//     const fbank = Array.from({length: nMelChannels}, (_, i) => Array(nFft / 2 + 1).fill(0));

//     for (let i = 1; i < nMelChannels + 1; i++) {
//         for (let j = bin[i - 1]; j < bin[i]; j++) {
//             fbank[i - 1][j] = (j - bin[i - 1]) / (bin[i] - bin[i - 1]);
//         }
//         for (let j = bin[i]; j < bin[i + 1]; j++) {
//             fbank[i - 1][j] = (bin[i + 1] - j) / (bin[i + 1] - bin[i]);
//         }
//     }

//     return fbank;
// }

// Apply mel filterbank to spectrogram
// function applyMelFilterbank(spectrogram, fbank) {
//     console.log(40, spectrogram);
//     console.log(41, fbank);
//     const melSpectrogram = Array.from(spectrogram).map(row => {row.map((value, i) => value * fbank[i]); console.log(row);});
//     console.log(42, melSpectrogram);
//     return melSpectrogram.map(row => Array.from({length: fbank.length}, (_, i) => row.reduce((sum, value) => sum + value[i], 0)));
// }

// function applyMelFilterbank(spectrogram, fbank) {
//     const melSpectrogram = Array.from(spectrogram).map(row => row.reduce((acc, value, i) => acc.concat(value * fbank[i]), []));
//     return melSpectrogram.map(row => Array.from({length: fbank.length}, (_, i) => row.reduce((sum, value, j) => sum + (value * fbank[i][j]), 0)));
// }

// function applyMelFilterbank(spectrogram, fbank) {
//     const melSpectrogram = [];
//     console.log('fbank shape: ', fbank.length, fbank[0].length);
//     console.log('spectrogram shape: ', spectrogram.length, spectrogram[0].length);
//     for (let i = 0; i < spectrogram.length; i++) {
//         const row = [];
//         for (let j = 0; j < spectrogram[i].length; j++) {
//             // if (spectrogram[i][j] == NaN) {
//             //     console.log(59, i, j, fbank[j])
//             // }
//             // if (spectrogram[i][j] * fbank[j] == NaN) {
//             //     console.log(61, i, j, fbank[j])
//             // }
//             // if (fbank[j] == NaN) {
//             //     console.log(63, i, j, fbank[j])
//             // }
//             row.push(spectrogram[i][j] * fbank[j]);
//         }
//         melSpectrogram.push(row);
//     }
//     console.log(62, melSpectrogram);

//     const result = [];
//     for (let i = 0; i < melSpectrogram.length; i++) {
//         const row = [];
//         for (let j = 0; j < fbank.length; j++) {
//             let sum = 0;
//             for (let k = 0; k < melSpectrogram[i].length; k++) {
//                 sum += melSpectrogram[i][k] * fbank[j][k];
//             }
//             row.push(sum);
//         }
//         result.push(row);
//     }

//     return result;
// }

/**
 * compute spectrogram * fbank.T := (21, 512) * (512, 80) => (21, 80)
 * @param {*} spectrogram e.g. (21, 512)
 * @param {*} fbank e.g. (80, 512)
 * @returns 
 */
function applyMelFilterbank(spectrogram, fbank) {
    const filteredSpectrogram = [];
    console.log('spectrogram shape: ', spectrogram.length, spectrogram[0].length);
    console.log('fbank shape: ', fbank.length, fbank[0].length);
    console.log(fbank);
    for (let i = 0; i < spectrogram.length; i++) {
        const row = [];

        for (let j = 0; j < fbank.length; j++) {
            let sum = 0;

            for (let k = 0; k < fbank[0].length; k++) {
                // console.log(spectrogram[i][k])
                // console.log(fbank[k][j])
                try {
                    sum += spectrogram[i][k] * fbank[k][j];
                } catch (e) {
                    sum += 0;
                    // console.log(149, k, j);
                }
            }

            row.push(sum);
        }

        console.log(row[0]);
        filteredSpectrogram.push(row);
    }

    return filteredSpectrogram;
}



// // Compute mel log spectrogram
// async function computeMelLogSpectrogram(audioData) {
//     // const audioData = audioBuffer.getChannelData(0);
//     const nSamples = audioData.length;
//     const nFft = filterLength;
//     const nHop = hopLength;
//     const nFrames = 1 + Math.floor((nSamples - nFft) / nHop);
//     const fbank = melFilterbank(nMelChannels, filterLength, samplingRate, melFmin, melFmax);
//     const spectrogram = Array.from({length: nFrames}, (_, i) => {
//         const start = i * nHop;
//         const frame = audioData.slice(start, start + nFft);
//         const windowed = frame.map((value, j) => value * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / winLength)));
//         const complexSpectrum = new Float32Array(nFft);
//         for (let j = 0; j < nFft; j++) {
//             complexSpectrum[j] = windowed[j];
//         }
//         const spectrum = audioContext.createPeriodicWave(complexSpectrum, new Float32Array(nFft)).getRealFloatFrequencyData();
//         return spectrum.slice(0, nFft / 2 + 1);
//     });

//     const melSpectrogram = applyMelFilterbank(spectrogram, fbank);
//     const logMelSpectrogram = melSpectrogram.map(row => row.map(value => Math.max(Math.log(value + 1e-5), minLogValue)));
//     return logMelSpectrogram;
// }
async function computeMelLogSpectrogram(audioData) {
    // const nSamples = audioData.length;
    // console.log(nSamples, filterLength, hopLength);
    // const nFft = filterLength;
    // const nHop = hopLength;
    // const nFrames = 1 + Math.floor((nSamples - nFft) / nHop);
    // const fbank = melFilterbank(nMelChannels, filterLength, samplingRate, melFmin, melFmax);
    const fbank = melFilterbank(nMelChannels, filterLength/2, samplingRate, melFmin, melFmax);
    // // console.log(74, fbank.slice(0, 5));
    // const spectrogram = Array.from({ length: nFrames }, (_, i) => {
    //     const start = i * nHop;
    //     const frame = audioData.slice(start, start + nFft);
    //     const windowed = frame.map((value, j) =>
    //         value * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / winLength))
    //     );
    //     console.log(windowed[0]);
    //     const fft = new FFT.complex(nFft, false);
    //     const complexSpectrum = fft.createComplexArray();
    //     for (let j = 0; j < nFft; j++) {
    //         complexSpectrum[j].re = windowed[j];
    //     }
    //     fft.transform(complexSpectrum);
    //     const magnitudeSpectrum = Array.from({ length: nFft / 2 + 1 }, (_, i) =>
    //         Math.sqrt(complexSpectrum[i].re ** 2 + complexSpectrum[i].im ** 2)
    //     );
    //     return magnitudeSpectrum;
    // });
    // console.log(97, audioData);
    // console.log(99, fbank);
    // const melSpectrogram = applyMelFilterbank(spectrogram, fbank);
    // const dataArray = Array.from(audioData);
    const melSpectrogram = applyMelFilterbank(audioData, fbank);
    console.log(102, melSpectrogram.slice(0, 5));
    const logMelSpectrogram = melSpectrogram.map(row =>
      row.map(value => Math.max(Math.log(value + 1e-5), minLogValue))
    );
    
    return logMelSpectrogram;
  }
  

module.exports = { computeMelLogSpectrogram }

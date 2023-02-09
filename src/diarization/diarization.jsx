import React, { useState, useEffect } from 'react';
// import * as ort from 'onnxruntime-web';
// import tf from '@tensorflow/tfjs';
// import * as wasmFeatureDetect from 'wasm-feature-detect';

import { computeMelLogSpectrogram } from './mel_log_spectrogram';
import { gruInference } from '../inference';
// import { LinkCluster } from '/Users/tugoph/Downloads/browser-ml-inference-main/src/diarization/clustering/online_links.ts';
import LinksCluster from '/Users/tugoph/Downloads/browser-ml-inference-main/src/diarization/online_links.ts'

const FFT_SIZE = 1024;
const HOP_LENGTH = 256;
const WIN_LENGTH = 1024;
const N_MEL_CHANNELS = 80;
const SAMPLING_RATE = 22050;
const MEL_FMIN = 0;
const MEL_FMAX = 8000.0;
const MAX_WAV_VALUE = 32768.0;
const MIN_LOG_VALUE = -11.52;
const MAX_LOG_VALUE = 1.2;
const SILENCE_THRESHOLD_DB = -10;
const N_FRAMES = 21;

const audioContext = new (window.AudioContext || window.webkitAudioContext) ({
   latencyHint: 'interactive',
   sampleRate: SAMPLING_RATE // 16000 max
});
const analyser = new AnalyserNode(audioContext, { "fftSize": FFT_SIZE, "smoothingTimeConstant": 0.9 }); // for AnalyserOptions
const dataArray = new Float32Array(FFT_SIZE / 2); // FFT_SIZE / 2 = analyser.frequencyBinCount;
const getAudioData = () => {
   const freqDataQueue = [];
   let currentFrames = 0;
   return new Promise((resolve, reject) => {
      const intervalID = setInterval(() => {
         analyser.getFloatFrequencyData(dataArray);
         if (dataArray[0] === -Infinity) {
            clearInterval(intervalID);
            resolve(freqDataQueue);
         }
         freqDataQueue.push(dataArray);

         if (++currentFrames === N_FRAMES) {
            clearInterval(intervalID);
            resolve(freqDataQueue);
         }
      }, FFT_SIZE / SAMPLING_RATE * 1000);
   });
}

export const Diarization = () => {

   const [audioRunning, setAudioRunning] = React.useState(false);
   const [cluster, setCluster] = React.useState(new LinksCluster.LinksCluster(0.8, 0.8, 0.7));
   // console.log(cluster.clusters);
   // const [freqData, setFreqData] = React.useState('');
   // const [spectroGram, setSpectroGram] = React.useState('');
   // const [gruEmbedder, setGruEmbedder] = React.useState(null);

   useEffect(() => {
      document.querySelector('button').addEventListener('click', () => {
         audioContext.resume().then(() => {
            console.log('Playback resumed successfully');
            if (audioContext.state === 'running') {
               console.log('running');
               setAudioRunning(true);

               navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
                  const source = audioContext.createMediaStreamSource(stream);
                  source.connect(analyser);
                  // analyser.connect(audioContext.destination);
                  const next = () => {
                     getAudioData().then((freqDataQueue) => { 
                        console.log('frequency data: ', freqDataQueue[0][0], freqDataQueue.length, freqDataQueue[0].length);
                        computeMelLogSpectrogram(freqDataQueue).then((melLogSpectrogram) => {
                           // console.log(68, `mel log shape: (${melLogSpectrogram.length}, ${melLogSpectrogram[0].length})`);
                           gruInference(melLogSpectrogram)
                              .then(
                                 (gruEmbedding) => {
                                    console.log(70, `gru embedding shape: (${gruEmbedding.output.dims}), ${gruEmbedding}`);
                                    // cluster.predict(gruEmbedding.output)
                                 }
                              );
                        });
                        next();
                     });
                  };
                  next();
               });
            }
         });
      });
   }, []);

   return (
      <div>
         <h1>Diarization</h1>
         <button>Start</button>
         <p>
            {/* {dataArray.slice(0, 5).map((data, index) => `Element ${index}: ${data} `)} */}
            {/* {dataArray[0]} */}
            {/* {freqData} */}
         </p>
      </div>
   )
}

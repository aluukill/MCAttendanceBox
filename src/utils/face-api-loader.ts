import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

// Multiple CDN options for reliability
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/',
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js-weights@master/',
  'https://unpkg.com/@vladmandic/face-api/model/',
];

async function tryLoadModels(attempts = 0): Promise<void> {
  const modelUrl = CDN_URLS[attempts % CDN_URLS.length];
  
  console.log(`Loading face-api models from: ${modelUrl}`);
  
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)
  ]);
}

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < CDN_URLS.length; attempt++) {
      try {
        await tryLoadModels(attempt);
        modelsLoaded = true;
        console.log('Face-api models loaded successfully');
        return;
      } catch (e) {
        lastError = e as Error;
        console.warn(`Failed to load models from CDN ${attempt + 1}, trying next...`, e);
      }
    }
    
    // All CDNs failed
    console.error('All face-api CDN attempts failed:', lastError);
    throw lastError || new Error('Failed to load face-api models from all CDNs');
  })();

  return loadingPromise;
}

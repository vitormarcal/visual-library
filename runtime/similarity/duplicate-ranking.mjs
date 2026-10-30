import { parentPort, workerData } from 'node:worker_threads'
import { duplicatePairs } from './duplicate-features.mjs'
parentPort.postMessage(duplicatePairs(workerData))

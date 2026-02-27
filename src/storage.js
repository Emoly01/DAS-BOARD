import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const storage = {
  async get(key) {
    const snap = await getDoc(doc(db, 'kv', key));
    if (!snap.exists()) throw new Error('not found');
    return { value: snap.data().value };
  },
  async set(key, value) {
    await setDoc(doc(db, 'kv', key), { value });
    return { key, value };
  }
};

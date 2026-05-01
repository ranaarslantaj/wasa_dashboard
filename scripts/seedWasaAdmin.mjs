/**
 * One-off seed for the `WasaAdmins` collection.
 *
 * Strategy:
 * 1) Read .env.local for Firebase config.
 * 2) Try to find an existing doc in the legacy `Admins` collection with
 *    email == dev@team.com. If found, COPY it (preserves uid) into
 *    `WasaAdmins`. Otherwise create a fresh doc.
 * 3) If a doc with the same email already exists in `WasaAdmins`, skip.
 *
 * Run with:  node scripts/seedWasaAdmin.mjs
 */

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  doc,
  where,
} from "firebase/firestore";

const TARGET_EMAIL = "dev@team.com";

function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnv();

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const wasaAdminsRef = collection(db, "WasaAdmins");

  // 1. Skip if already seeded.
  const existing = await getDocs(
    query(wasaAdminsRef, where("email", "==", TARGET_EMAIL), limit(1)),
  );
  if (!existing.empty) {
    const e = existing.docs[0];
    console.log(`✓ Already exists in WasaAdmins/${e.id} — nothing to do.`);
    console.log("  Doc data:", JSON.stringify(e.data(), null, 2));
    return;
  }

  // 2. Try to copy from legacy Admins collection.
  let copiedFrom = null;
  let payload = null;
  try {
    const legacyAdmins = collection(db, "Admins");
    const legacy = await getDocs(
      query(legacyAdmins, where("email", "==", TARGET_EMAIL), limit(1)),
    );
    if (!legacy.empty) {
      const legacyDoc = legacy.docs[0];
      copiedFrom = `Admins/${legacyDoc.id}`;
      const d = legacyDoc.data();
      payload = {
        uid: d.uid || "",
        name: d.name || "Dev Team",
        email: TARGET_EMAIL,
        phone: d.phone || "",
        password: "",
        accessLevel: d.accessLevel || "province",
        province: d.province || "Punjab",
        division: d.division ?? null,
        district: d.district ?? null,
        tehsil: d.tehsil ?? null,
        status: d.status || "active",
        createdAt: d.createdAt || serverTimestamp(),
        lastLogin: d.lastLogin ?? null,
        updatedAt: serverTimestamp(),
      };
    }
  } catch (err) {
    console.warn("  (Could not read legacy Admins:", err?.message || err, ")");
  }

  // 3. Fall back to a fresh super-admin doc.
  if (!payload) {
    payload = {
      uid: "",
      name: "Dev Team",
      email: TARGET_EMAIL,
      phone: "",
      password: "",
      accessLevel: "province",
      province: "Punjab",
      division: null,
      district: null,
      tehsil: null,
      status: "active",
      createdAt: serverTimestamp(),
      lastLogin: null,
      updatedAt: serverTimestamp(),
    };
  }

  // 4. Write. Use a deterministic-ish id derived from email so the seed is
  //    idempotent if rerun (you can also delete this doc and rerun).
  const docId = TARGET_EMAIL.replace(/[^a-z0-9]/gi, "_");
  await setDoc(doc(db, "WasaAdmins", docId), payload, { merge: false });

  console.log(`✓ Seeded WasaAdmins/${docId}`);
  if (copiedFrom) console.log(`  Copied scope/uid from legacy ${copiedFrom}.`);
  else console.log("  Created fresh super-admin doc (uid empty — login will still work via email match).");
  console.log("  Payload:", JSON.stringify(payload, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ Seed failed:", err?.code || "", err?.message || err);
    if (String(err?.code) === "permission-denied") {
      console.error(
        "\nFirestore security rules are blocking unauthenticated writes.",
      );
      console.error(
        "Either temporarily allow writes in test mode, or add the doc via the",
      );
      console.error("Firebase console → Firestore → WasaAdmins.");
    }
    process.exit(1);
  });

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "nexora-social-2026.firebaseapp.com",
  projectId: "nexora-social-2026",
  storageBucket: "nexora-social-2026.firebasestorage.app",
  messagingSenderId: "549843291889",
  appId: "REPLACE_WITH_FIREBASE_WEB_APP_ID",
  measurementId: "G-3E8ZB5PG9T"
};
const VAPID_PUBLIC_KEY = "REPLACE_WITH_FIREBASE_WEB_PUSH_VAPID_PUBLIC_KEY";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let createMode = false, stopFeed = null;

function errorText(e) {
  const messages = {
    "auth/email-already-in-use": "This email already has an account. Sign in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/operation-not-allowed": "Enable Email/Password sign-in in Firebase Authentication.",
    "permission-denied": "Firestore denied this action. Publish the repository's Firestore rules in Firebase Console."
  };
  return messages[e?.code] || e?.message || "Something went wrong. Try again.";
}
$("mode").addEventListener("click", () => {
  createMode = !createMode;
  $("name").classList.toggle("hidden", !createMode);
  $("name").required = createMode;
  $("formTitle").textContent = createMode ? "Create your account" : "Welcome to NEXORA";
  $("formDesc").textContent = createMode ? "A few details and you're part of the community." : "Join the community. Your next connection starts here.";
  $("submit").textContent = createMode ? "Create account" : "Sign in";
  $("mode").textContent = createMode ? "I already have an account" : "Create a new account";
});
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault(); $("submit").disabled = true; $("authStatus").textContent = "Please wait…";
  try {
    const email = $("email").value.trim(), password = $("password").value;
    if (createMode) {
      const name = $("name").value.trim();
      if (!name) throw new Error("Enter your display name.");
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await setDoc(doc(db, "users", result.user.uid), { uid: result.user.uid, email, displayName: name, bio: "", photoUrl: "", createdAt: serverTimestamp() });
    } else await signInWithEmailAndPassword(auth, email, password);
    $("authStatus").textContent = "";
  } catch (e) { $("authStatus").textContent = errorText(e); }
  finally { $("submit").disabled = false; }
});
$("logout").addEventListener("click", () => signOut(auth));
$("publish").addEventListener("click", async () => {
  const user = auth.currentUser, text = $("postText").value.trim();
  if (!user) return;
  if (!text) { $("feedStatus").textContent = "Write something before sharing."; return; }
  $("publish").disabled = true;
  try {
    await addDoc(collection(db, "posts"), { uid: user.uid, authorName: user.displayName || user.email?.split("@")[0] || "NEXORA member", text, createdAt: serverTimestamp() });
    $("postText").value = ""; $("feedStatus").textContent = "Your post has been shared.";
  } catch (e) { $("feedStatus").textContent = errorText(e); }
  finally { $("publish").disabled = false; }
});
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function renderPost(p) {
  const name = p.authorName || "NEXORA member", initial = [...name.trim()][0]?.toUpperCase() || "N";
  const date = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : "Just now";
  return `<article class="post"><div class="posthead"><span class="avatar">${esc(initial)}</span><div>${esc(name)}<div class="postdate">${esc(date)}</div></div></div><div class="postbody">${esc(p.text)}</div><div class="postdate">✦ NEXORA community</div></article>`;
}
function startFeed() {
  if (stopFeed) stopFeed();
  $("feedStatus").textContent = "Loading posts…";
  stopFeed = onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30)), snap => {
    $("feed").innerHTML = snap.docs.map(d => renderPost(d.data())).join("");
    $("feedStatus").textContent = snap.empty ? "Be the first to share a post." : "";
  }, e => { $("feedStatus").textContent = errorText(e); });
}
onAuthStateChanged(auth, user => {
  const yes = Boolean(user);
  $("authPanel").classList.toggle("hidden", yes); $("memberPanel").classList.toggle("hidden", !yes);
  $("logout").classList.toggle("hidden", !yes); $("composer").classList.toggle("hidden", !yes);
  $("welcome").textContent = user ? `Hello, ${user.displayName || user.email?.split("@")[0] || "there"}.` : "You're in.";
  if (yes) startFeed();
  else { if (stopFeed) stopFeed(); stopFeed = null; $("feed").innerHTML = ""; $("feedStatus").textContent = "Sign in to explore the community."; }
});
$("push").addEventListener("click", async () => {
  $("push").disabled = true; $("pushStatus").textContent = "Preparing browser notifications…";
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in first.");
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !await isSupported()) throw new Error("This browser does not support Firebase web push.");
    if (Notification.permission === "denied") throw new Error("Notifications are blocked in browser settings.");
    if (await Notification.requestPermission() !== "granted") throw new Error("Notification permission was not granted.");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration });
    if (!token) throw new Error("Could not obtain a browser push token.");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenId = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
    await setDoc(doc(db, "users", user.uid, "fcmTokens", tokenId), { token, platform: "web", updatedAt: serverTimestamp() });
    $("pushStatus").textContent = "Browser notifications are enabled.";
  } catch (e) { $("pushStatus").textContent = errorText(e); }
  finally { $("push").disabled = false; }
});
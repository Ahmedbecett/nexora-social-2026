set -e
export JAVA_HOME=/opt/jdk ANDROID_HOME=/opt/android ANDROID_SDK_ROOT=/opt/android PATH=/opt/jdk/bin:$PATH
set -a; source /home/user/keys/keystore.env; set +a
cd /home/user/repo
npx vite build >/dev/null
rm -rf dist/download && npx cap sync android
cd android
./gradlew --no-daemon -Dorg.gradle.workers.max=2 assembleRelease 2>&1 | tail -25
ls -la app/build/outputs/apk/release/

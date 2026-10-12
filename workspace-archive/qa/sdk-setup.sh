set -e
cd /tmp
if [ ! -x /opt/jdk/bin/java ]; then
  curl -sL -o jdk.tgz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  sudo mkdir -p /opt/jdk && sudo tar -xzf jdk.tgz -C /opt/jdk --strip-components=1 && rm jdk.tgz
fi
if [ ! -d /opt/android/build-tools/35.0.0 ]; then
  sudo mkdir -p /opt/android && sudo chown -R $(id -u) /opt/android
  curl -sL -o clt.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  mkdir -p /opt/android/cmdline-tools && unzip -q -o clt.zip -d /opt/android/cmdline-tools && rm -rf /opt/android/cmdline-tools/latest && mv /opt/android/cmdline-tools/cmdline-tools /opt/android/cmdline-tools/latest && rm clt.zip
  export JAVA_HOME=/opt/jdk
  yes | /opt/android/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android --licenses >/dev/null
  /opt/android/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android "platform-tools" "platforms;android-35" "build-tools;35.0.0" "build-tools;34.0.0" >/dev/null
fi
[ -f /swapfile ] || (sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null)
sudo /sbin/swapon /swapfile 2>/dev/null || true
echo SDK_OK

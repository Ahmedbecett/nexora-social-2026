import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val signProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.ahmedbecetti.nexora.kt"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ahmedbecetti.nexora"
        minSdk = 24
        targetSdk = 35
        versionCode = 16
        versionName = "3.1.0"
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
        manifestPlaceholders["admobAppId"] = "ca-app-pub-6858364141205978~9239771129"
        buildConfigField("String", "ADMOB_BANNER", "\"ca-app-pub-6858364141205978/9187800239\"")
        buildConfigField("String", "API_BASE", "\"https://nexora-social-2026.vercel.app/api/\"")
    }

    signingConfigs {
        create("release") {
            if (signProps.isNotEmpty()) {
                storeFile = file(signProps.getProperty("storeFile"))
                storePassword = signProps.getProperty("storePassword")
                keyAlias = signProps.getProperty("keyAlias")
                keyPassword = signProps.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (signProps.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    testOptions { unitTests { isIncludeAndroidResources = true; all { it.maxHeapSize = "1200m"; it.systemProperty("robolectric.logging", "stdout") } } }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-ui:1.5.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    // Google sign-in (same Firebase project / OAuth clients as 2.6 — nothing changed in Firebase)
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    // Calls: native WebRTC (same signaling as the web app, through the chat itself)
    implementation("io.getstream:stream-webrtc-android:1.3.10")
    // Ads: AdMob banner (same app/unit as 2.6)
    implementation("com.google.android.gms:play-services-ads:24.4.0")
    // Chat stickers (SVG) and animated GIFs
    implementation("io.coil-kt:coil-svg:2.7.0")
    implementation("io.coil-kt:coil-gif:2.7.0")
    testImplementation(composeBom)
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

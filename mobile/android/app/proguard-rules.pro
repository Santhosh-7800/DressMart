# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- Phase 19: minifyEnabled was just turned on for release builds. Capacitor core/plugins and the
# Firebase SDK each already ship their own consumer-proguard-rules (bundled in their AAR, merged in
# automatically), so most of what an app like this needs is already covered — these are a small,
# standard defensive addition for the reflection/JS-bridge surfaces those consumer rules are least
# likely to fully cover on their own. ---

# Capacitor's native<->WebView bridge invokes plugin methods via reflection — stripping/renaming
# them would silently break every native feature (push notifications, status bar, back button).
-keep class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public *;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin public class *

# Any @JavascriptInterface-annotated method is called directly by the WebView's JS engine by name —
# R8 has no way to know that from Java-side call graphs alone.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Firebase Cloud Messaging deserializes push payloads via reflection.
-keep class com.google.firebase.messaging.** { *; }

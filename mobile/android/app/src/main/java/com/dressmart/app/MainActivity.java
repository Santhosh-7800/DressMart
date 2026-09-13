package com.dressmart.app;

import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

// @capgo/capacitor-social-login requires this explicit marker interface before it will honor a
// `scopes` option on Google Sign-In (authService.ts requests `email`/`profile`) — it's a deliberate
// opt-in gate (the interface method itself is a no-op) rather than anything this activity needs to
// actually implement.
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}

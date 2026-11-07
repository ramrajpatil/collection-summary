package collection.summary.build;

import android.Manifest;
import android.telephony.SmsManager;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
        name = "SmsSender",
        permissions = {
                @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS })
        })
public class SmsSenderPlugin extends Plugin {

    @PluginMethod
    public void send(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }
        sendSms(call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            sendSms(call);
        } else {
            call.reject("SMS_PERMISSION_DENIED");
        }
    }

    private void sendSms(PluginCall call) {
        String phone = call.getString("phone");
        String message = call.getString("message");
        if (phone == null || message == null) {
            call.reject("phone and message are required");
            return;
        }
        try {
            SmsManager manager = SmsManager.getDefault();
            ArrayList<String> parts = manager.divideMessage(message);
            if (parts.size() > 1) {
                manager.sendMultipartTextMessage(phone, null, parts, null, null);
            } else {
                manager.sendTextMessage(phone, null, message, null, null);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("SMS_FAILED: " + e.getMessage(), e);
        }
    }
}
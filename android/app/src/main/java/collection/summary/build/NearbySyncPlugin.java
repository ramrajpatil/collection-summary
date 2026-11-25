package collection.summary.build;

import android.Manifest;
import android.os.Build;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(
        name = "NearbySync",
        permissions = {
                @Permission(
                        alias = "location",
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }),
                @Permission(
                        alias = "bluetooth",
                        strings = {
                                Manifest.permission.BLUETOOTH_SCAN,
                                Manifest.permission.BLUETOOTH_ADVERTISE,
                                Manifest.permission.BLUETOOTH_CONNECT
                        }),
                @Permission(
                        alias = "wifi",
                        strings = { Manifest.permission.NEARBY_WIFI_DEVICES })
        })
public class NearbySyncPlugin extends Plugin {

    private static final String SERVICE_ID = "collection.summary.build.sync";
    private static final int MAX_BYTES = 1 << 20;

    private ConnectionsClient client;
    private String connectedEndpointId;
    private final Map<String, String> endpointNames = new HashMap<>();

    private final ConnectionLifecycleCallback connectionLifecycleCallback = new ConnectionLifecycleCallback() {
        @Override
        public void onConnectionInitiated(@NonNull String endpointId, @NonNull ConnectionInfo info) {
            endpointNames.put(endpointId, info.getEndpointName());
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            event.put("endpointName", info.getEndpointName());
            event.put("isIncoming", info.isIncomingConnection());
            event.put("authenticationDigits", info.getAuthenticationDigits());
            notifyListeners("connectionInitiated", event);
            // Both phones belong to the same user, so accept immediately.
            if (client != null) {
                client.acceptConnection(endpointId, payloadCallback);
            }
        }

        @Override
        public void onConnectionResult(@NonNull String endpointId, @NonNull ConnectionResolution result) {
            boolean connected = result.getStatus().isSuccess();
            if (connected) {
                connectedEndpointId = endpointId;
            }
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            event.put("endpointName", endpointNames.getOrDefault(endpointId, ""));
            event.put("connected", connected);
            if (!connected) {
                event.put("message", result.getStatus().getStatusMessage());
            }
            notifyListeners("connectionResult", event);
        }

        @Override
        public void onDisconnected(@NonNull String endpointId) {
            if (endpointId.equals(connectedEndpointId)) {
                connectedEndpointId = null;
            }
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            notifyListeners("disconnected", event);
        }
    };

    private final PayloadCallback payloadCallback = new PayloadCallback() {
        @Override
        public void onPayloadReceived(@NonNull String endpointId, @NonNull Payload payload) {
            if (payload.getType() != Payload.Type.BYTES) return;
            byte[] bytes = payload.asBytes();
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            event.put("data", bytes == null ? "" : new String(bytes, StandardCharsets.UTF_8));
            notifyListeners("payloadReceived", event);
        }

        @Override
        public void onPayloadTransferUpdate(
                @NonNull String endpointId,
                @NonNull PayloadTransferUpdate update) {
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            event.put("status", update.getStatus());
            event.put("bytesTransferred", update.getBytesTransferred());
            event.put("totalBytes", update.getTotalBytes());
            notifyListeners("payloadTransferUpdate", event);
        }
    };

    private final EndpointDiscoveryCallback endpointDiscoveryCallback = new EndpointDiscoveryCallback() {
        @Override
        public void onEndpointFound(
                @NonNull String endpointId,
                @NonNull DiscoveredEndpointInfo info) {
            endpointNames.put(endpointId, info.getEndpointName());
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            event.put("endpointName", info.getEndpointName());
            event.put("serviceId", info.getServiceId());
            notifyListeners("endpointFound", event);
        }

        @Override
        public void onEndpointLost(@NonNull String endpointId) {
            JSObject event = new JSObject();
            event.put("endpointId", endpointId);
            notifyListeners("endpointLost", event);
        }
    };

    @Override
    protected void handleOnDestroy() {
        stopInternal();
    }

    private String[] requiredAliases() {
        List<String> aliases = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            aliases.add("bluetooth");
            aliases.add("wifi");
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            aliases.add("bluetooth");
        } else {
            aliases.add("location");
        }
        return aliases.toArray(new String[0]);
    }

    private boolean hasPermissions() {
        for (String alias : requiredAliases()) {
            if (getPermissionState(alias) != PermissionState.GRANTED) {
                return false;
            }
        }
        return true;
    }

    private boolean ensureClient(PluginCall call) {
        if (client == null) {
            try {
                client = Nearby.getConnectionsClient(getContext());
            } catch (Exception e) {
                call.reject("Nearby Connections is unavailable: " + e.getMessage(), e);
                return false;
            }
        }
        return true;
    }

    @PermissionCallback
    private void onPermissionResult(PluginCall call) {
        if (!hasPermissions()) {
            call.reject("Nearby permissions were denied");
            return;
        }
        String method = call.getMethodName();
        if ("startAdvertising".equals(method)) {
            doStartAdvertising(call);
        } else if ("startDiscovery".equals(method)) {
            doStartDiscovery(call);
        } else {
            call.reject("Unexpected permission continuation");
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int status = GoogleApiAvailability.getInstance()
                .isGooglePlayServicesAvailable(getContext());
        JSObject ret = new JSObject();
        ret.put("available", status == ConnectionResult.SUCCESS);
        if (status != ConnectionResult.SUCCESS) {
            ret.put("reason", "Google Play services is not available");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        if (!ensureClient(call)) return;
        if (!hasPermissions()) {
            requestPermissionForAliases(requiredAliases(), call, "onPermissionResult");
            return;
        }
        doStartAdvertising(call);
    }

    private void doStartAdvertising(PluginCall call) {
        String name = call.getString("name", "Collection device");
        AdvertisingOptions options = new AdvertisingOptions.Builder()
                .setStrategy(Strategy.P2P_POINT_TO_POINT)
                .build();
        client.startAdvertising(name, SERVICE_ID, connectionLifecycleCallback, options)
                .addOnSuccessListener(ignored -> call.resolve())
                .addOnFailureListener(e -> call.reject(
                        "Unable to start advertising: " + e.getMessage(), e));
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (!ensureClient(call)) return;
        if (!hasPermissions()) {
            requestPermissionForAliases(requiredAliases(), call, "onPermissionResult");
            return;
        }
        doStartDiscovery(call);
    }

    private void doStartDiscovery(PluginCall call) {
        DiscoveryOptions options = new DiscoveryOptions.Builder()
                .setStrategy(Strategy.P2P_POINT_TO_POINT)
                .build();
        client.startDiscovery(SERVICE_ID, endpointDiscoveryCallback, options)
                .addOnSuccessListener(ignored -> call.resolve())
                .addOnFailureListener(e -> call.reject(
                        "Unable to start discovery: " + e.getMessage(), e));
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensureClient(call)) return;
        String endpointId = call.getString("endpointId");
        if (endpointId == null) {
            call.reject("endpointId is required");
            return;
        }
        String name = call.getString("name", "Collection device");
        client.requestConnection(name, endpointId, connectionLifecycleCallback)
                .addOnSuccessListener(ignored -> call.resolve())
                .addOnFailureListener(e -> call.reject(
                        "Unable to connect: " + e.getMessage(), e));
    }

    @PluginMethod
    public void accept(PluginCall call) {
        if (!ensureClient(call)) return;
        String endpointId = call.getString("endpointId");
        if (endpointId == null) {
            call.reject("endpointId is required");
            return;
        }
        client.acceptConnection(endpointId, payloadCallback)
                .addOnSuccessListener(ignored -> call.resolve())
                .addOnFailureListener(e -> call.reject(
                        "Unable to accept connection: " + e.getMessage(), e));
    }

    @PluginMethod
    public void reject(PluginCall call) {
        if (client == null) {
            call.reject("Nearby Connections is unavailable");
            return;
        }
        String endpointId = call.getString("endpointId");
        if (endpointId == null) {
            call.reject("endpointId is required");
            return;
        }
        client.rejectConnection(endpointId)
                .addOnSuccessListener(ignored -> call.resolve())
                .addOnFailureListener(e -> call.reject(
                        "Unable to reject connection: " + e.getMessage(), e));
    }

    @PluginMethod
    public void send(PluginCall call) {
        if (!ensureClient(call)) return;
        String data = call.getString("data");
        if (data == null) {
            call.reject("data is required");
            return;
        }
        String endpointId = call.getString("endpointId", connectedEndpointId);
        if (endpointId == null) {
            call.reject("No connected device");
            return;
        }
        byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) {
            call.reject("Data is too large for a nearby transfer");
            return;
        }
        final Payload payload;
        try {
            payload = Payload.fromBytes(bytes);
        } catch (IllegalArgumentException e) {
            call.reject("Data is too large for a nearby transfer", e);
            return;
        }
        client.sendPayload(endpointId, payload)
                .addOnSuccessListener(ignored -> call.resolve())
                .addOnFailureListener(e -> call.reject(
                        "Unable to send data: " + e.getMessage(), e));
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (client == null) {
            call.resolve();
            return;
        }
        String endpointId = call.getString("endpointId", connectedEndpointId);
        if (endpointId == null) {
            call.resolve();
            return;
        }
        if (endpointId.equals(connectedEndpointId)) {
            connectedEndpointId = null;
        }
        client.disconnectFromEndpoint(endpointId);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopInternal();
        call.resolve();
    }

    private void stopInternal() {
        if (client != null) {
            client.stopAdvertising();
            client.stopDiscovery();
            client.stopAllEndpoints();
        }
        connectedEndpointId = null;
        endpointNames.clear();
    }
}

package collection.summary.build;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        final String fileName = call.getString("fileName");
        final String data = call.getString("data");
        final String mimeType = call.getString("mimeType", "application/octet-stream");
        final boolean share = Boolean.TRUE.equals(call.getBoolean("share", false));

        if (fileName == null || data == null) {
            call.reject("fileName and data are required");
            return;
        }

        final Context context = getContext();
        try {
            final Uri uri;
            final String location;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = context.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Unable to create the file in Downloads");
                    return;
                }
                OutputStream output = resolver.openOutputStream(uri);
                if (output == null) {
                    resolver.delete(uri, null, null);
                    call.reject("Unable to open the file for writing");
                    return;
                }
                output.write(data.getBytes(StandardCharsets.UTF_8));
                output.flush();
                output.close();

                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, done, null, null);

                location = Environment.DIRECTORY_DOWNLOADS + "/" + fileName;
            } else {
                File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) {
                    call.reject("External storage is unavailable");
                    return;
                }
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("Unable to create the Downloads directory");
                    return;
                }
                File file = new File(dir, fileName);
                FileOutputStream output = new FileOutputStream(file);
                output.write(data.getBytes(StandardCharsets.UTF_8));
                output.flush();
                output.close();
                uri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        file);
                location = file.getAbsolutePath();
            }

            if (share && getActivity() != null) {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mimeType);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, fileName);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(send, fileName);
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(chooser);
            }

            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            ret.put("location", location);
            ret.put("fileName", fileName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Unable to save the file: " + e.getMessage(), e);
        }
    }
}

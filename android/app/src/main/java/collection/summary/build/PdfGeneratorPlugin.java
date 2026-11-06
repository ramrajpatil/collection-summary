package collection.summary.build;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "PdfGenerator")
public class PdfGeneratorPlugin extends Plugin {

    private static final String TAG = "PdfGenerator";

    private static final int PAGE_W = 595;
    private static final int PAGE_H = 842;
    // Generous margins so the printed sheet can be hole-punched, stamped and filed.
    private static final int MARGIN_TOP = 31;    // ~11mm
    private static final int MARGIN_RIGHT = 45;  // ~16mm
    private static final int MARGIN_BOTTOM = 51; // ~18mm
    private static final int MARGIN_LEFT = 62;   // ~22mm (binding side)
    private static final int CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
    private static final int CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
    private static final int CSS_WIDTH = Math.round(CONTENT_W * 96f / 72f);
    private static final int CSS_PAGE_H = Math.round(CONTENT_H * 96f / 72f);
    private static final float RENDER_SCALE = 300f / 96f;

    @PluginMethod
    public void generate(PluginCall call) {
        final String html = call.getString("html");
        final String fileName = call.getString("fileName", "document.pdf");
        final String baseUrl = call.getString("baseUrl", "file:///android_asset/public/");
        final boolean saveToDownloads =
                Boolean.TRUE.equals(call.getBoolean("saveToDownloads", true));

        if (html == null) {
            call.reject("html is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                DisplayMetrics dm = getActivity().getResources().getDisplayMetrics();
                final float density = dm.density;

                final WebView webView = new WebView(getActivity());
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setAllowFileAccess(true);
                webView.getSettings().setAllowContentAccess(true);
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setUseWideViewPort(false);
                webView.getSettings().setLoadWithOverviewMode(false);
                webView.setBackgroundColor(Color.WHITE);

                final ViewGroup root = getActivity().findViewById(android.R.id.content);
                final FrameLayout container = new FrameLayout(getActivity());
                container.setLayoutParams(new FrameLayout.LayoutParams(dm.widthPixels, dm.heightPixels));
                container.setTranslationX(-(dm.widthPixels * 3f));
                container.setTranslationY(-(dm.heightPixels * 3f));
                root.addView(container);
                container.addView(webView, new FrameLayout.LayoutParams(
                        Math.round(CSS_WIDTH * density),
                        Math.round(CSS_PAGE_H * density)));

                final Runnable cleanup = () -> {
                    try {
                        container.removeAllViews();
                        root.removeView(container);
                    } catch (Exception ignored) {
                    }
                };

                layoutWebView(webView, density, CSS_PAGE_H);

                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        view.postDelayed(() -> {
                            try {
                                File dir = new File(getActivity().getCacheDir(), "pdf");
                                if (!dir.exists()) dir.mkdirs();
                                final File pdf = new File(dir, fileName);
                                measureContent(webView, html, baseUrl, density, pdf,
                                        saveToDownloads, call, cleanup);
                            } catch (Exception e) {
                                cleanup.run();
                                call.reject("PDF generation failed: " + e.getMessage(), e);
                            }
                        }, 700);
                    }
                });

                webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject("Unable to start PDF generation: " + e.getMessage(), e);
            }
        });
    }

    private static final String MIME_PDF = "application/pdf";

    private static final class SavedPdf {
        final String uri;
        final String location;

        SavedPdf(String uri, String location) {
            this.uri = uri;
            this.location = location;
        }
    }

    /**
     * Copies the generated PDF into the public Downloads folder so the file is
     * visible in the Downloads app / file manager instead of the app cache.
     */
    private SavedPdf publishToDownloads(File source, String fileName) throws Exception {
        Context context = getContext();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, MIME_PDF);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new Exception("Unable to create the file in Downloads");
            }

            try (InputStream in = new FileInputStream(source);
                 OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) {
                    throw new Exception("Unable to open the file for writing");
                }
                copy(in, out);
            } catch (Exception e) {
                resolver.delete(uri, null, null);
                throw e;
            }

            ContentValues done = new ContentValues();
            done.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, done, null, null);

            return new SavedPdf(
                    uri.toString(),
                    Environment.DIRECTORY_DOWNLOADS + "/" + fileName);
        }

        File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) {
            throw new Exception("External storage is unavailable");
        }
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("Unable to create the Downloads directory");
        }
        File dest = new File(dir, fileName);
        try (InputStream in = new FileInputStream(source);
             OutputStream out = new FileOutputStream(dest)) {
            copy(in, out);
        }
        return new SavedPdf(
                FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        dest).toString(),
                dest.getAbsolutePath());
    }

    private String cacheUri(File file) {
        try {
            return FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file).toString();
        } catch (Exception e) {
            return "file://" + file.getAbsolutePath();
        }
    }

    private void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }

    @PluginMethod
    public void share(PluginCall call) {
        final String uriString = call.getString("uri");
        final String fileName = call.getString("fileName", "document.pdf");
        final String text = call.getString("text", "");
        final String packageName = call.getString("packageName");

        if (uriString == null) {
            call.reject("uri is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                Uri uri = Uri.parse(uriString);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(MIME_PDF);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, fileName);
                if (text != null && !text.isEmpty()) {
                    send.putExtra(Intent.EXTRA_TEXT, text);
                }
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                if (packageName != null && !packageName.isEmpty()) {
                    Intent direct = new Intent(send);
                    direct.setPackage(packageName);
                    try {
                        getActivity().startActivity(direct);
                        call.resolve();
                        return;
                    } catch (ActivityNotFoundException ignored) {
                        // App not installed, use the system share sheet instead.
                    }
                }

                Intent chooser = Intent.createChooser(send, fileName);
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(chooser);
                call.resolve();
            } catch (Exception e) {
                call.reject("Unable to share the PDF: " + e.getMessage(), e);
            }
        });
    }

    private void layoutWebView(WebView webView, float density, int cssHeight) {
        int layoutW = Math.round(CSS_WIDTH * density);
        int layoutH = Math.round(cssHeight * density);
        ViewGroup.LayoutParams lp = webView.getLayoutParams();
        if (lp != null) {
            lp.width = layoutW;
            lp.height = layoutH;
            webView.setLayoutParams(lp);
        }
        webView.measure(
                View.MeasureSpec.makeMeasureSpec(layoutW, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(layoutH, View.MeasureSpec.EXACTLY));
        webView.layout(0, 0, layoutW, layoutH);
    }

    private void measureContent(
            WebView webView,
            String html,
            String baseUrl,
            float density,
            File pdfFile,
            boolean saveToDownloads,
            PluginCall call,
            Runnable cleanup) {
        webView.scrollTo(0, 0);
        webView.postDelayed(() -> webView.evaluateJavascript(
                "(function(){"
                        + "var rows=document.querySelectorAll('tbody tr');"
                        + "var ends=[];"
                        + "for(var i=0;i<rows.length;i++){"
                        + "var r=rows[i].getBoundingClientRect();"
                        + "ends.push(Math.round(r.bottom+window.scrollY));}"
                        + "var foot=document.querySelector('tfoot');"
                        + "if(foot){var f=foot.getBoundingClientRect();"
                        + "ends.push(Math.round(f.bottom+window.scrollY));}"
                        + "var notes=document.querySelector('.notes');"
                        + "var notesTop=notes?Math.round(notes.getBoundingClientRect().top+window.scrollY):0;"
                        + "var run=document.querySelector('.running');"
                        + "var reservedTop=0;"
                        + "if(run){var prev=run.getAttribute('style');"
                        + "run.style.cssText='display:block;position:absolute;top:0;left:0;right:0;visibility:hidden;';"
                        + "reservedTop=Math.round(run.getBoundingClientRect().height);"
                        + "if(prev===null){run.removeAttribute('style');}else{run.setAttribute('style',prev);}}"
                        + "var last=document.querySelector('.signs')||document.body;"
                        + "var h=Math.round(last.getBoundingClientRect().bottom+window.scrollY);"
                        + "return window.innerWidth+'|'+window.devicePixelRatio+'|'+h+'|'+notesTop"
                        + "+'|'+reservedTop+'|'+ends.join(',');})()",
                value -> {
                    int contentCss;
                    int notesTop;
                    int reservedTop;
                    int[] rowEnds;
                    try {
                        String raw = value.replace("\"", "").trim();
                        String[] parts = raw.split("\\|", -1);
                        Log.d(TAG, "viewport=" + parts[0] + " dpr=" + parts[1]
                                + " contentCss=" + parts[2] + " notesTop=" + parts[3]
                                + " reservedTop=" + parts[4]);
                        contentCss = (int) Math.ceil(Double.parseDouble(parts[2]));
                        notesTop = (int) Math.ceil(Double.parseDouble(parts[3]));
                        reservedTop = (int) Math.ceil(Double.parseDouble(parts[4]));
                        if (parts.length > 5 && !parts[5].isEmpty()) {
                            String[] ends = parts[5].split(",");
                            rowEnds = new int[ends.length];
                            for (int i = 0; i < ends.length; i++) {
                                rowEnds[i] = (int) Math.round(Double.parseDouble(ends[i]));
                            }
                        } else {
                            rowEnds = new int[0];
                        }
                    } catch (Exception e) {
                        cleanup.run();
                        call.reject("Unable to measure document: " + value);
                        return;
                    }
                    if (contentCss <= 0) {
                        cleanup.run();
                        call.reject("Document is empty");
                        return;
                    }

                    List<Integer> breaks =
                            computeBreaks(contentCss, notesTop, rowEnds, reservedTop);
                    Log.d(TAG, "pages=" + (breaks.size() - 1) + " breaks=" + breaks);

                    PdfDocument document = new PdfDocument();
                    renderPage(webView, html, baseUrl, document, breaks, 0,
                            reservedTop, density, pdfFile, saveToDownloads, call, cleanup);
                }), 120);
    }

    private List<Integer> computeBreaks(
            int contentCss,
            int notesTop,
            int[] rowEnds,
            int reservedTop) {
        List<Integer> breaks = new ArrayList<>();
        breaks.add(0);
        int start = 0;
        int pageIndex = 0;

        while (start < contentCss) {
            // Pages after the first reserve space for the repeated header and
            // column row, so they can hold less table content.
            int capacity =
                    pageIndex == 0 ? CSS_PAGE_H : CSS_PAGE_H - reservedTop;
            int limit = start + capacity;
            if (limit >= contentCss) {
                breaks.add(contentCss);
                break;
            }

            boolean footerFitsOnOnePage =
                    notesTop > start && contentCss - notesTop <= capacity;

            if (footerFitsOnOnePage && notesTop <= limit) {
                int br = start;
                for (int end : rowEnds) {
                    if (end > start && end <= notesTop) br = Math.max(br, end);
                }
                if (br <= start) br = notesTop;
                breaks.add(br);
                start = br;
                pageIndex++;
                continue;
            }

            int best = -1;
            for (int end : rowEnds) {
                if (end > start && end <= limit) best = Math.max(best, end);
            }
            if (best <= start) best = limit;
            breaks.add(best);
            start = best;
            pageIndex++;
        }

        if (breaks.get(breaks.size() - 1) != contentCss) {
            breaks.add(contentCss);
        }
        return breaks;
    }

    private String injectPageOffset(
            String html,
            int offsetCss,
            boolean continued,
            int reservedTop) {
        String pageHtml = html;
        if (continued && pageHtml.contains("<body>")) {
            pageHtml = pageHtml.replace("<body>", "<body class=\"continued\">");
        }
        int top = continued ? reservedTop - offsetCss : -offsetCss;
        String style = "<style>body{position:relative;top:" + top + "px;}</style>";
        int idx = pageHtml.indexOf("</head>");
        if (idx >= 0) {
            return pageHtml.substring(0, idx) + style + pageHtml.substring(idx);
        }
        return style + pageHtml;
    }

    private void renderPage(
            WebView webView,
            String html,
            String baseUrl,
            PdfDocument document,
            List<Integer> breaks,
            int pageIndex,
            int reservedTop,
            float density,
            File pdfFile,
            boolean saveToDownloads,
            PluginCall call,
            Runnable cleanup) {
        int pageCount = breaks.size() - 1;

        if (pageIndex >= pageCount) {
            try (FileOutputStream fos = new FileOutputStream(pdfFile)) {
                document.writeTo(fos);
            } catch (Exception e) {
                document.close();
                cleanup.run();
                call.reject("Unable to write PDF: " + e.getMessage(), e);
                return;
            }
            document.close();
            cleanup.run();

            long size = pdfFile.length();
            String uri;
            String location;
            if (!saveToDownloads) {
                uri = cacheUri(pdfFile);
                location = pdfFile.getAbsolutePath();
            } else {
                try {
                    SavedPdf saved = publishToDownloads(pdfFile, pdfFile.getName());
                    uri = saved.uri;
                    location = saved.location;
                    pdfFile.delete();
                } catch (Exception e) {
                    Log.e(TAG, "Unable to save PDF to Downloads, keeping cache copy", e);
                    uri = cacheUri(pdfFile);
                    location = pdfFile.getAbsolutePath();
                }
            }

            JSObject ret = new JSObject();
            ret.put("path", location);
            ret.put("uri", uri);
            ret.put("size", size);
            ret.put("pages", pageCount);
            call.resolve(ret);
            return;
        }

        final int offset = breaks.get(pageIndex);
        final boolean continued = pageIndex > 0;
        final int contentCss = breaks.get(pageIndex + 1) - offset;
        // Continuation pages also need room for the repeated header/column row
        // drawn above the first data row.
        final int visibleCss = continued ? reservedTop + contentCss : contentCss;

        layoutWebView(webView, density, visibleCss);
        webView.scrollTo(0, 0);

        final String pageHtml =
                injectPageOffset(html, offset, continued, reservedTop);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.postDelayed(() -> {
                    try {
                        int bmpW = Math.round(CSS_WIDTH * RENDER_SCALE);
                        int bmpH = Math.max(1, Math.round(visibleCss * RENDER_SCALE));

                        Bitmap bitmap = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888);
                        Canvas canvas = new Canvas(bitmap);
                        canvas.drawColor(Color.WHITE);
                        float scale = RENDER_SCALE / density;
                        canvas.scale(scale, scale);
                        webView.draw(canvas);

                        PdfDocument.PageInfo info =
                                new PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, pageIndex + 1).create();
                        PdfDocument.Page page = document.startPage(info);
                        Canvas pageCanvas = page.getCanvas();

                        Rect src = new Rect(0, 0, bmpW, bmpH);
                        float dstH = visibleCss * 72f / 96f;
                        RectF dst = new RectF(MARGIN_LEFT, MARGIN_TOP,
                                MARGIN_LEFT + CONTENT_W, MARGIN_TOP + dstH);
                        Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
                        pageCanvas.drawBitmap(bitmap, src, dst, paint);
                        document.finishPage(page);
                        bitmap.recycle();

                        renderPage(webView, html, baseUrl, document, breaks,
                                pageIndex + 1, reservedTop, density, pdfFile,
                                saveToDownloads, call, cleanup);
                    } catch (Exception e) {
                        document.close();
                        cleanup.run();
                        call.reject("Unable to render page: " + e.getMessage(), e);
                    }
                }, 700);
            }
        });

        webView.loadDataWithBaseURL(baseUrl, pageHtml, "text/html", "UTF-8", null);
    }
}

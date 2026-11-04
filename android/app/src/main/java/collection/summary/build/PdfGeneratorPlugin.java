package collection.summary.build;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "PdfGenerator")
public class PdfGeneratorPlugin extends Plugin {

    private static final String TAG = "PdfGenerator";

    private static final int PAGE_W = 595;
    private static final int PAGE_H = 842;
    // Generous margins so the printed sheet can be hole-punched, stamped and filed.
    private static final int MARGIN_TOP = 51;    // ~18mm
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
                                measureContent(webView, html, baseUrl, density, pdf, call, cleanup);
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
                        + "var last=document.querySelector('.signs')||document.body;"
                        + "var h=Math.round(last.getBoundingClientRect().bottom+window.scrollY);"
                        + "return window.innerWidth+'|'+window.devicePixelRatio+'|'+h+'|'+notesTop"
                        + "+'|'+ends.join(',');})()",
                value -> {
                    int contentCss;
                    int notesTop;
                    int[] rowEnds;
                    try {
                        String raw = value.replace("\"", "").trim();
                        String[] parts = raw.split("\\|", -1);
                        Log.d(TAG, "viewport=" + parts[0] + " dpr=" + parts[1]
                                + " contentCss=" + parts[2] + " notesTop=" + parts[3]);
                        contentCss = (int) Math.ceil(Double.parseDouble(parts[2]));
                        notesTop = (int) Math.ceil(Double.parseDouble(parts[3]));
                        if (parts.length > 4 && !parts[4].isEmpty()) {
                            String[] ends = parts[4].split(",");
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

                    List<Integer> breaks = computeBreaks(contentCss, notesTop, rowEnds);
                    Log.d(TAG, "pages=" + (breaks.size() - 1) + " breaks=" + breaks);

                    PdfDocument document = new PdfDocument();
                    renderPage(webView, html, baseUrl, document, breaks, 0,
                            density, pdfFile, call, cleanup);
                }), 120);
    }

    private List<Integer> computeBreaks(int contentCss, int notesTop, int[] rowEnds) {
        List<Integer> breaks = new ArrayList<>();
        breaks.add(0);
        int start = 0;

        while (start < contentCss) {
            int limit = start + CSS_PAGE_H;
            if (limit >= contentCss) {
                breaks.add(contentCss);
                break;
            }

            boolean footerFitsOnOnePage =
                    notesTop > start && contentCss - notesTop <= CSS_PAGE_H;

            if (footerFitsOnOnePage && notesTop <= limit) {
                int br = start;
                for (int end : rowEnds) {
                    if (end > start && end <= notesTop) br = Math.max(br, end);
                }
                if (br <= start) br = notesTop;
                breaks.add(br);
                start = br;
                continue;
            }

            int best = -1;
            for (int end : rowEnds) {
                if (end > start && end <= limit) best = Math.max(best, end);
            }
            if (best <= start) best = limit;
            breaks.add(best);
            start = best;
        }

        if (breaks.get(breaks.size() - 1) != contentCss) {
            breaks.add(contentCss);
        }
        return breaks;
    }

    private String injectPageOffset(String html, int offsetCss) {
        if (offsetCss <= 0) return html;
        String style = "<style>body{position:relative;top:-" + offsetCss + "px;}</style>";
        int idx = html.indexOf("</head>");
        if (idx >= 0) {
            return html.substring(0, idx) + style + html.substring(idx);
        }
        return style + html;
    }

    private void renderPage(
            WebView webView,
            String html,
            String baseUrl,
            PdfDocument document,
            List<Integer> breaks,
            int pageIndex,
            float density,
            File pdfFile,
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

            JSObject ret = new JSObject();
            ret.put("path", pdfFile.getAbsolutePath());
            ret.put("uri", "file://" + pdfFile.getAbsolutePath());
            ret.put("size", pdfFile.length());
            ret.put("pages", pageCount);
            call.resolve(ret);
            return;
        }

        final int offset = breaks.get(pageIndex);
        final int visibleCss = breaks.get(pageIndex + 1) - offset;

        layoutWebView(webView, density, visibleCss);
        webView.scrollTo(0, 0);

        final String pageHtml = injectPageOffset(html, offset);

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
                        RectF dst = new RectF(MARGIN_LEFT, MARGIN_TOP, MARGIN_LEFT + CONTENT_W, MARGIN_TOP + dstH);
                        Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
                        pageCanvas.drawBitmap(bitmap, src, dst, paint);
                        document.finishPage(page);
                        bitmap.recycle();

                        renderPage(webView, html, baseUrl, document, breaks,
                                pageIndex + 1, density, pdfFile, call, cleanup);
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

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using NexoraWindows.Ads;
using NexoraWindows.Bridge;
using NexoraWindows.Config;

namespace NexoraWindows.UI
{
    public sealed class MainForm : Form
    {
        private static readonly string[] OAuthPopupHosts =
        {
            "nexora-social-2026.vercel.app",
            "accounts.google.com",
            "apis.google.com",
            "github.com",
            "vercel.com",
            "appleid.apple.com",
            "login.microsoftonline.com"
        };

        private readonly MgAdsConfig _config;
        private readonly string _initialUrl;
        private readonly Panel _bannerHostPanel;
        private readonly Panel _statusOverlay;
        private readonly Label _statusLabel;
        private readonly Button _retryButton;
        private readonly WebView2 _webView;
        private readonly Timer _resizeDebounceTimer;

        private MgAdsManager _adsManager;
        private WebViewBridge _bridge;
        private IntPtr _iconHandle = IntPtr.Zero;
        private bool _adsStarted;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool DestroyIcon(IntPtr hIcon);

        public MainForm(MgAdsConfig config, string launchUrl)
        {
            _config = config ?? MgAdsConfig.LoadFromApplicationDirectory();
            _initialUrl = ResolveInitialUrl(launchUrl, _config);

            Text = string.IsNullOrWhiteSpace(_config.ProductTitle) ? "NEXORA AI by BECETTI" : _config.ProductTitle;
            BackColor = Color.FromArgb(18, 12, 48); // #120C30 brand splash background
            MinimumSize = new Size(920, 640);
            Size = new Size(1360, 860);
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.Dpi;

            TryApplyAppIcon();

            // Dedicated bottom banner container: hidden (0 px) until a REAL MG Banner ad loads.
            _bannerHostPanel = new Panel
            {
                Name = "MgBannerHostPanel",
                Dock = DockStyle.Bottom,
                Height = Math.Max(90, _config.Units.Banner.Height + 6),
                BackColor = Color.FromArgb(18, 12, 48),
                Visible = false
            };

            _webView = new WebView2
            {
                Name = "NexoraWebView",
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = Color.FromArgb(18, 12, 48)
            };

            _statusOverlay = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(18, 12, 48),
                Visible = true
            };

            _statusLabel = new Label
            {
                Text = "Loading NEXORA AI by BECETTI…",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 12F, FontStyle.Regular),
                AutoSize = false,
                TextAlign = ContentAlignment.MiddleCenter,
                Dock = DockStyle.Fill
            };

            _retryButton = new Button
            {
                Text = "Retry",
                Visible = false,
                Width = 140,
                Height = 38,
                FlatStyle = FlatStyle.Flat,
                ForeColor = Color.White,
                BackColor = Color.FromArgb(67, 56, 202),
                Anchor = AnchorStyles.None
            };
            _retryButton.Click += async (s, e) => await InitializeWebViewAsync();

            _statusOverlay.Controls.Add(_retryButton);
            _statusOverlay.Controls.Add(_statusLabel);
            _statusOverlay.Resize += (s, e) =>
            {
                _retryButton.Left = (_statusOverlay.Width - _retryButton.Width) / 2;
                _retryButton.Top = (_statusOverlay.Height / 2) + 34;
            };

            // Add Fill controls first, Bottom docked container second so Dock layout stacks cleanly.
            Controls.Add(_webView);
            Controls.Add(_statusOverlay);
            Controls.Add(_bannerHostPanel);
            _statusOverlay.BringToFront();

            _adsManager = new MgAdsManager(this, _bannerHostPanel, _config);

            _resizeDebounceTimer = new Timer { Interval = 350 };
            _resizeDebounceTimer.Tick += async (s, e) =>
            {
                _resizeDebounceTimer.Stop();
                await OnViewportSettledAsync();
            };

            Load += MainForm_Load;
            Resize += (s, e) =>
            {
                if (_adsStarted && WindowState != FormWindowState.Minimized)
                {
                    _resizeDebounceTimer.Stop();
                    _resizeDebounceTimer.Start();
                }
            };
            FormClosing += MainForm_FormClosing;
        }

        private async void MainForm_Load(object sender, EventArgs e)
        {
            await InitializeWebViewAsync();
        }

        private async Task InitializeWebViewAsync()
        {
            _retryButton.Visible = false;
            _statusOverlay.Visible = true;
            _statusLabel.Text = "Loading NEXORA AI by BECETTI…";

            try
            {
                string userDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "NEXORA",
                    "WebView2Profile");

                Directory.CreateDirectory(userDataFolder);

                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, null);
                await _webView.EnsureCoreWebView2Async(env);

                CoreWebView2 core = _webView.CoreWebView2;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = true;
                core.Settings.IsWebMessageEnabled = true;
                core.Settings.AreDevToolsEnabled = Debugger.IsAttached;

                // Ensure NEXORA frontend immediately recognizes MSIX native WebView2 host
                // before any web-only ad scripts run.
                string originJson = Newtonsoft.Json.JsonConvert.SerializeObject(_config.AppOrigin);
                string initScript =
                    "(function(){" +
                    "try{" +
                    "if(location.origin===" + originJson + "){" +
                    "sessionStorage.setItem('nx_surface','msix');" +
                    "sessionStorage.setItem('nx_host','native-webview2');" +
                    "document.documentElement.dataset.nxNativeHost='webview2-mgads';" +
                    "}" +
                    "}catch(e){}" +
                    "})();";
                await core.AddScriptToExecuteOnDocumentCreatedAsync(initScript);

                core.NewWindowRequested -= OnNewWindowRequested;
                core.NewWindowRequested += OnNewWindowRequested;

                core.NavigationCompleted -= OnNavigationCompleted;
                core.NavigationCompleted += OnNavigationCompleted;

                if (_bridge != null)
                {
                    _bridge.Dispose();
                }
                _bridge = new WebViewBridge(core, _adsManager, _config.AppOrigin);

                core.Navigate(_initialUrl);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                _statusLabel.Text = "Microsoft Edge WebView2 Runtime is required to run NEXORA AI.\r\nPlease install WebView2 Runtime and restart.";
                _retryButton.Visible = true;
            }
            catch (Exception ex)
            {
                _statusLabel.Text = "Unable to start NEXORA AI (" + ex.GetType().Name + "). Check your connection and retry.";
                _retryButton.Visible = true;
            }
        }

        private async void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (e.IsSuccess)
            {
                _statusOverlay.Visible = false;
                _bridge?.PushCurrentState();

                if (!_adsStarted)
                {
                    _adsStarted = true;
                    await InitializeAdsNonBlockingAsync();
                }
            }
            else if (e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled)
            {
                // Keep WebView visible if a sub-navigation failed after initial load;
                // only show retry overlay if the app hasn't rendered yet.
                if (_statusOverlay.Visible)
                {
                    _statusLabel.Text = "No internet connection or service unreachable.\r\nNEXORA AI requires network access to connect to AI services.";
                    _retryButton.Visible = true;
                }
            }
        }

        private async Task InitializeAdsNonBlockingAsync()
        {
            try
            {
                bool ready = await _adsManager.InitializeAsync();
                _bridge?.PushCurrentState();

                if (ready)
                {
                    // Load and show official 728x90 Banner only if real inventory is available.
                    await _adsManager.ShowBannerAsync(force: true);

                    // Couplet (300x600) only appears if viewport >= 1560x760 and current view is suitable.
                    if (_bridge != null)
                    {
                        await _adsManager.SyncCoupletForContextAsync(_bridge.ActiveView, _bridge.HasMessages);
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[NEXORA][MGAds] Non-blocking startup init error: " + ex.GetType().Name);
            }
        }

        private async Task OnViewportSettledAsync()
        {
            if (_adsManager == null || _bridge == null) return;
            try
            {
                if (ClientSize.Width < _config.Units.Banner.Width)
                {
                    _adsManager.HideBanner("viewport-too-narrow");
                }
                await _adsManager.SyncCoupletForContextAsync(_bridge.ActiveView, _bridge.HasMessages);
            }
            catch
            {
                // Keep UI responsive
            }
        }

        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            string uriText = e.Uri ?? string.Empty;
            if (string.IsNullOrEmpty(uriText) ||
                uriText.StartsWith("about:", StringComparison.OrdinalIgnoreCase) ||
                uriText.StartsWith("blob:", StringComparison.OrdinalIgnoreCase))
            {
                // Allow Firebase / OAuth blank popup windows and preview blobs natively in WebView2
                return;
            }

            Uri uri;
            if (!Uri.TryCreate(uriText, UriKind.Absolute, out uri))
            {
                e.Handled = true;
                return;
            }

            if (IsOAuthOrAppHost(uri))
            {
                // Let WebView2 handle OAuth popups (Google Sign-In, Firebase, GitHub, Vercel)
                // so window.opener.postMessage and auth callbacks work identically to Edge.
                return;
            }

            // Open external links in the user's default browser
            if (uri.Scheme == Uri.UriSchemeHttps ||
                uri.Scheme == Uri.UriSchemeHttp ||
                uri.Scheme == Uri.UriSchemeMailto)
            {
                e.Handled = true;
                try
                {
                    Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
                }
                catch
                {
                    // Ignore shell launch errors
                }
            }
            else
            {
                e.Handled = true;
            }
        }

        private static bool IsOAuthOrAppHost(Uri uri)
        {
            string host = uri.Host ?? string.Empty;
            if (host.EndsWith(".firebaseapp.com", StringComparison.OrdinalIgnoreCase) ||
                host.EndsWith(".web.app", StringComparison.OrdinalIgnoreCase) ||
                host.EndsWith(".google.com", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            foreach (string allowed in OAuthPopupHosts)
            {
                if (string.Equals(host, allowed, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static string ResolveInitialUrl(string launchUrl, MgAdsConfig config)
        {
            if (!string.IsNullOrWhiteSpace(launchUrl))
            {
                Uri parsed;
                Uri origin;
                if (Uri.TryCreate(launchUrl, UriKind.Absolute, out parsed) &&
                    Uri.TryCreate(config.AppOrigin, UriKind.Absolute, out origin) &&
                    string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(parsed.Host, origin.Host, StringComparison.OrdinalIgnoreCase))
                {
                    string sep = string.IsNullOrEmpty(parsed.Query) ? "?" : "&";
                    if (parsed.Query.IndexOf("nx_surface=", StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        return parsed.AbsoluteUri + sep + "nx_surface=msix&nx_host=native-webview2";
                    }
                    return parsed.AbsoluteUri;
                }
            }
            return config.StartUrl;
        }

        private void TryApplyAppIcon()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string[] candidates =
                {
                    Path.Combine(baseDir, "Assets", "Square44x44Logo.targetsize-48.png"),
                    Path.Combine(baseDir, "Assets", "StoreLogo.png"),
                    Path.Combine(baseDir, "Assets", "Square44x44Logo.png")
                };

                foreach (string candidate in candidates)
                {
                    if (!File.Exists(candidate)) continue;
                    using (var bmp = new Bitmap(candidate))
                    {
                        _iconHandle = bmp.GetHicon();
                        Icon = Icon.FromHandle(_iconHandle);
                        return;
                    }
                }
            }
            catch
            {
                // Icon is cosmetic; never block startup
            }
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            _resizeDebounceTimer.Stop();
            _resizeDebounceTimer.Dispose();
            if (_bridge != null)
            {
                _bridge.Dispose();
                _bridge = null;
            }
            if (_adsManager != null)
            {
                _adsManager.Dispose();
                _adsManager = null;
            }
            if (_iconHandle != IntPtr.Zero)
            {
                DestroyIcon(_iconHandle);
                _iconHandle = IntPtr.Zero;
            }
        }
    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace NOXMFD
{
    // One Cougar profile's frame binding (docs/cougar-mfd.md, OSB binding): which physical frame it is
    // (a JoystickIdentity, "guid|name"; empty = not paired yet) and which of that device's buttons each
    // of the 28 frame inputs is.
    internal sealed class CougarProfile
    {
        public string Name = string.Empty;
        public string Device = string.Empty;
        public Dictionary<string, int> Binds = new Dictionary<string, int>(StringComparer.Ordinal);
    }

    internal enum CougarBindResult { Bound, Invalid, OtherDevice, Conflict }

    // The Cougar frame bindings, on the game PC. Everything else a Cougar profile holds (its pages, pin,
    // brightness) stays in the browser; this is keyed by the same profile name (?mfd=), so a profile's
    // bindings follow it to any browser. A profile is one frame: binding its first button pairs it to
    // that device, and re-pairing (another USB port, a frame that came back with a new identity) keeps
    // every button.
    //
    // Static, plugin-lifetime. BCL-only behind the same ConfigDir/LogWarning seam as RouteStore and
    // ThemeStore, so tools/tests drives the whole store. Mutators run on the Unity main thread
    // (CommandDispatcher.Drain, CougarFrames.Poll) and rebuild StateJson as their last step; the HTTP
    // and SSE threads only read it.
    internal static class CougarBindStore
    {
        // The 28 frame inputs: the 20 face keys, then each corner rocker's two halves (minus, plus).
        internal static readonly string[] Inputs =
        {
            "T1", "T2", "T3", "T4", "T5", "R1", "R2", "R3", "R4", "R5",
            "B5", "B4", "B3", "B2", "B1", "L5", "L4", "L3", "L2", "L1",
            "tl-", "tl+", "tr-", "tr+", "bl-", "bl+", "br-", "br+",
        };
        internal const int MaxProfiles = 16;
        internal const int MaxButton = 255;

        internal static string? ConfigDir;
        internal static Action<string>? LogWarning;

        private static Dictionary<string, CougarProfile> _profiles = new Dictionary<string, CougarProfile>(StringComparer.Ordinal);

        internal static volatile string StateJson = "{}";
        // Bumped on every change, so the frame poller rebuilds its per-profile view only when needed.
        internal static int Version;

        private static string FilePath => Path.Combine(ConfigDir ?? ".", "com.roque.NOXMFD.cougar.json");

        internal static bool IsInput(string? input) => input != null && Array.IndexOf(Inputs, input) >= 0;
        internal static bool IsRocker(string input) => input.Length == 3 && (input[2] == '-' || input[2] == '+');

        // The browser's profile names (CougarOsb.profileName): upper case, A-Z 0-9 space _ -, at most 24.
        internal static string? CleanName(string? raw)
        {
            if (raw == null) return null;
            var sb = new StringBuilder();
            foreach (char ch in raw.ToUpperInvariant())
                if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == ' ' || ch == '_' || ch == '-') sb.Append(ch);
            string s = sb.ToString().Trim();
            if (s.Length > 24) s = s.Substring(0, 24).Trim();
            return s.Length > 0 && s == raw ? s : null;
        }

        internal static IEnumerable<CougarProfile> Profiles => _profiles.Values;
        internal static CougarProfile? Find(string? name) => name != null && _profiles.TryGetValue(name, out CougarProfile? p) ? p : null;

        // ── lifecycle ────────────────────────────────────────────────────────────────────────

        public static void Load()
        {
            _profiles = new Dictionary<string, CougarProfile>(StringComparer.Ordinal);
            if (File.Exists(FilePath))
            {
                try
                {
                    if (JsonLite.Parse(File.ReadAllText(FilePath)) is Dictionary<string, object?> root &&
                        root.TryGetValue("profiles", out object? list) && list is List<object?> items)
                    {
                        foreach (object? item in items)
                        {
                            if (_profiles.Count >= MaxProfiles) break;
                            if (item is not Dictionary<string, object?> d) continue;
                            string? name = CleanName(d.TryGetValue("name", out object? n) ? n as string : null);
                            if (name == null || _profiles.ContainsKey(name)) continue;
                            var p = new CougarProfile { Name = name, Device = d.TryGetValue("device", out object? dev) ? dev as string ?? string.Empty : string.Empty };
                            if (d.TryGetValue("binds", out object? b) && b is Dictionary<string, object?> binds)
                                foreach (var kv in binds)
                                    if (IsInput(kv.Key) && kv.Value is double v && v >= 0 && v <= MaxButton) p.Binds[kv.Key] = (int)v;
                            _profiles[name] = p;
                        }
                    }
                }
                catch (Exception ex)
                {
                    LogWarning?.Invoke($"[NOXMFD] Cougar bindings file unreadable, starting with none: {ex.Message}");
                    _profiles = new Dictionary<string, CougarProfile>(StringComparer.Ordinal);
                }
            }
            Rebuild();
        }

        private static void Rebuild()
        {
            StateJson = BuildState();
            Version++;
        }

        private static void Save()
        {
            Rebuild();
            try { ConfigBackup.BackupIfExists(FilePath); File.WriteAllText(FilePath, StateJson); }
            catch (Exception ex) { LogWarning?.Invoke($"[NOXMFD] failed to persist Cougar bindings: {ex.Message}"); }
        }

        // {"profiles":[{"name":"LEFT","device":"guid|name","deviceName":"...","binds":{"T1":3,...}}]}:
        // the file, and the persisted half of the "cougar" SSE event (CougarFrames adds the live half).
        private static string BuildState()
        {
            var sb = new StringBuilder("{\"profiles\":[");
            bool first = true;
            foreach (CougarProfile p in _profiles.Values)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append("{\"name\":\"").Append(JsonLite.EscapeJson(p.Name))
                  .Append("\",\"device\":\"").Append(JsonLite.EscapeJson(p.Device))
                  .Append("\",\"deviceName\":\"").Append(JsonLite.EscapeJson(JoystickIdentity.Name(p.Device)))
                  .Append("\",\"binds\":{");
                bool firstBind = true;
                foreach (string input in Inputs)
                {
                    if (!p.Binds.TryGetValue(input, out int button)) continue;
                    if (!firstBind) sb.Append(',');
                    firstBind = false;
                    sb.Append('"').Append(input).Append("\":").Append(button);
                }
                sb.Append("}}");
            }
            return sb.Append("]}").ToString();
        }

        private static CougarProfile? FindOrAdd(string? raw)
        {
            string? name = CleanName(raw);
            if (name == null) return null;
            if (_profiles.TryGetValue(name, out CougarProfile? p)) return p;
            if (_profiles.Count >= MaxProfiles) return null;
            p = new CougarProfile { Name = name };
            _profiles[name] = p;
            return p;
        }

        // Which profile and input already use `button` on `device`, other than (profile, input) itself.
        internal static (string Profile, string Input)? Owner(string device, int button, string? exceptProfile = null, string? exceptInput = null)
        {
            foreach (CougarProfile p in _profiles.Values)
            {
                if (p.Device != device) continue;
                foreach (var kv in p.Binds)
                    if (kv.Value == button && !(p.Name == exceptProfile && kv.Key == exceptInput)) return (p.Name, kv.Key);
            }
            return null;
        }

        // ── commands (main thread) ───────────────────────────────────────────────────────────

        // Pairs `profile` with the frame `device` (its first bind does this too). Its buttons stay: a
        // re-pair is the same frame under a new identity. Another profile paired to the same device
        // keeps its pairing; two windows can share one frame.
        public static bool Pair(string? profile, string? device)
        {
            if (string.IsNullOrEmpty(device)) return false;
            CougarProfile? p = FindOrAdd(profile);
            if (p == null) return false;
            p.Device = device!;
            Save();
            return true;
        }

        // Binds `input` of `profile` to `button` on `device`. A profile not paired yet pairs to that
        // device; a button on another frame is refused (OtherDevice); a button already used by another
        // input of a profile on this frame is refused (Conflict, `owner` says which) unless `force`,
        // which moves it here.
        public static CougarBindResult Bind(string? profile, string? input, string? device, int button, bool force,
                                            out (string Profile, string Input)? owner)
        {
            owner = null;
            if (!IsInput(input) || string.IsNullOrEmpty(device) || button < 0 || button > MaxButton) return CougarBindResult.Invalid;
            CougarProfile? p = FindOrAdd(profile);
            if (p == null) return CougarBindResult.Invalid;
            // A profile with nothing bound yet just re-pairs to whichever frame the press came from.
            if (p.Device.Length > 0 && p.Device != device && p.Binds.Count > 0) return CougarBindResult.OtherDevice;
            owner = Owner(device!, button, p.Name, input);
            if (owner.HasValue && !force) return CougarBindResult.Conflict;
            if (owner.HasValue) Find(owner.Value.Profile)!.Binds.Remove(owner.Value.Input);
            p.Device = device!;
            p.Binds[input!] = button;
            Save();
            return CougarBindResult.Bound;
        }

        // Sets (button >= 0) or clears (button < 0) one input directly: the wizard's undo and redo, and
        // clearing a key. Doesn't change the pairing.
        public static bool Set(string? profile, string? input, int button)
        {
            if (!IsInput(input) || button > MaxButton) return false;
            CougarProfile? p = button < 0 ? Find(CleanName(profile)) : FindOrAdd(profile);
            if (p == null) return button < 0;
            if (button < 0) p.Binds.Remove(input!);
            else p.Binds[input!] = button;
            Save();
            return true;
        }

        // Forgets a profile's frame and every button.
        public static bool Clear(string? profile)
        {
            string? name = CleanName(profile);
            if (name == null || !_profiles.Remove(name)) return false;
            Save();
            return true;
        }
    }
}

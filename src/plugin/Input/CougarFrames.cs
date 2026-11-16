using System;
using System.Collections.Generic;
using System.Text;
using Rewired;
using UnityEngine;

namespace NOXMFD
{
    // Reads the Cougar frames (docs/cougar-mfd.md, OSB binding). Rewired sees each frame as a joystick;
    // every profile paired in CougarBindStore is found among the connected joysticks by its identity
    // (CougarFrameLogic.Find), and each of its bound buttons going down or up becomes one event in
    // Presses, which every SSE connection relays as "cougar-press" to the browsers. A Cougar window acts
    // on the events for its own profile, so two frames drive two windows and one frame can drive more.
    //
    // The binding wizard arms a capture (Arm): the next fresh button on any joystick is bound to the
    // armed input (or, for "pair", only pairs the profile with that frame). A conflict or a button from
    // another frame is reported in the state and the capture stays armed for the next press; Force
    // binds the reported button anyway. While armed, no presses are relayed, and the game reads
    // joysticks even unfocused (the browser has focus while binding), as Keybinds' own capture does.
    //
    // Polled once per frame on the main thread (MissionLifecycle), at the main menu as in a mission.
    internal static class CougarFrames
    {
        internal const string PairInput = "pair";
        internal static readonly CougarPressLog Presses = new CougarPressLog();

        // The "cougar" SSE event: the store's profiles plus the live half (which are connected, the
        // capture). Rebuilt on the main thread whenever either changes; the SSE threads only read it.
        internal static volatile string StateJson = "{\"profiles\":[],\"live\":{}}";

        private sealed class Live
        {
            public string Profile = string.Empty;
            public int Joy = -1;                                  // index in ReInput.controllers.Joysticks, -1 = not connected
            public (string Input, int Button)[] Binds = Array.Empty<(string, int)>();
            public bool[] Held = Array.Empty<bool>();
        }
        private static List<Live> _live = new List<Live>();
        private static int _joyCount = -1;
        private static int _storeVersion = -1;
        private static bool _stateDirty = true;
        private static bool _bgShown;

        // Capture.
        private const int SettleFrames = 3;
        private static string? _capProfile, _capInput;
        private static int _capSettle;
        private static readonly HashSet<(int Joy, int Btn)> _latched = new HashSet<(int, int)>();
        private static string _capResult = string.Empty;                  // "", bound, paired, conflict, other-device
        private static (string Profile, string Input)? _capOwner;
        private static (string Device, int Button)? _capPending;          // the conflicting press, for Force
        private static int _capSeq;                                       // bumps on every result
        private static bool _prevRun, _prevIgnore;

        internal static bool Capturing => _capProfile != null;

        public static void Poll()
        {
            if (CougarBindStore.Version != _storeVersion) { _storeVersion = CougarBindStore.Version; Relink(); }
            if (ReInput.isReady && ReInput.controllers.joystickCount != _joyCount) Relink();
            if (Keybinds.BackgroundInput != _bgShown) { _bgShown = Keybinds.BackgroundInput; _stateDirty = true; }
            if (_stateDirty) { _stateDirty = false; StateJson = BuildState(); }
            if (!ReInput.isReady) return;

            if (Capturing) { Capture(); return; }

            IList<Joystick> joys = ReInput.controllers.Joysticks;
            foreach (Live live in _live)
            {
                if (live.Joy < 0 || live.Joy >= joys.Count) continue;
                Joystick joy = joys[live.Joy];
                for (int i = 0; i < live.Binds.Length; i++)
                {
                    int b = live.Binds[i].Button;
                    bool down = b < joy.buttonCount && joy.GetButton(b);
                    if (down == live.Held[i]) continue;
                    live.Held[i] = down;
                    Presses.Add(live.Profile, live.Binds[i].Input, down);
                }
            }
        }

        // Rebuilds the per-profile view after a binding or the set of joysticks changed. Anything held
        // is released first, so a window never keeps a key held whose binding just went away.
        private static void Relink()
        {
            ReleaseAll();
            var ids = new List<(string Guid, string Name)>();
            if (ReInput.isReady)
            {
                IList<Joystick> joys = ReInput.controllers.Joysticks;
                _joyCount = joys.Count;
                foreach (Joystick j in joys) ids.Add(Keybinds.Identity(j));
            }
            var live = new List<Live>();
            foreach (CougarProfile p in CougarBindStore.Profiles)
            {
                var binds = new List<(string, int)>();
                foreach (string input in CougarBindStore.Inputs)
                    if (p.Binds.TryGetValue(input, out int b)) binds.Add((input, b));
                live.Add(new Live
                {
                    Profile = p.Name,
                    Joy = p.Device.Length > 0 ? CougarFrameLogic.Find(p.Device, ids) : -1,
                    Binds = binds.ToArray(),
                    Held = new bool[binds.Count],
                });
            }
            _live = live;
            _stateDirty = true;
        }

        private static void ReleaseAll()
        {
            foreach (Live live in _live)
                for (int i = 0; i < live.Held.Length; i++)
                    if (live.Held[i]) { live.Held[i] = false; Presses.Add(live.Profile, live.Binds[i].Input, false); }
        }

        // ── capture ──────────────────────────────────────────────────────────────────────────

        internal static bool Arm(string? profile, string? input)
        {
            if (CougarBindStore.CleanName(profile) == null) return false;
            if (input != PairInput && !CougarBindStore.IsInput(input)) return false;
            if (!Capturing)
            {
                _prevRun = Application.runInBackground;
                Application.runInBackground = true;
                if (ReInput.isReady)
                {
                    _prevIgnore = ReInput.configuration.ignoreInputWhenAppNotInFocus;
                    ReInput.configuration.ignoreInputWhenAppNotInFocus = false;
                }
                ReleaseAll();
            }
            _capProfile = profile;
            _capInput = input;
            _capSettle = SettleFrames;
            _latched.Clear();
            _capResult = string.Empty;
            _capOwner = null;
            _capPending = null;
            _stateDirty = true;
            return true;
        }

        internal static void Cancel()
        {
            if (!Capturing) return;
            _capProfile = _capInput = null;
            _capPending = null;
            _capOwner = null;
            Application.runInBackground = _prevRun;
            if (ReInput.isReady) ReInput.configuration.ignoreInputWhenAppNotInFocus = _prevIgnore;
            _stateDirty = true;
            // Resync held state without relaying: whatever is down now was pressed while binding.
            foreach (Live live in _live) MarkHeldSilently(live);
        }

        // Binds the press the capture just reported as a conflict, taking the button from its owner.
        internal static bool Force()
        {
            if (!Capturing || _capPending == null || _capInput == PairInput) return false;
            var (device, button) = _capPending.Value;
            if (CougarBindStore.Bind(_capProfile, _capInput, device, button, true, out _) != CougarBindResult.Bound) return false;
            Finish("bound");
            return true;
        }

        private static void Capture()
        {
            IList<Joystick> joys = ReInput.controllers.Joysticks;
            if (_capSettle > 0)
            {
                if (--_capSettle == 0)
                    for (int i = 0; i < joys.Count; i++)
                        for (int b = 0; b < joys[i].buttonCount; b++)
                            if (joys[i].GetButton(b)) _latched.Add((i, b));
                return;
            }
            for (int i = 0; i < joys.Count; i++)
            {
                Joystick joy = joys[i];
                for (int b = 0; b < joy.buttonCount; b++)
                {
                    if (!joy.GetButton(b)) { _latched.Remove((i, b)); continue; }
                    if (_latched.Contains((i, b)) || !joy.GetButtonDown(b)) continue;
                    _latched.Add((i, b));   // once handled, this press is spent until it is released
                    var (guid, devName) = Keybinds.Identity(joy);
                    OnPress(JoystickIdentity.Make(guid, devName), b, joy.name);
                    return;
                }
            }
        }

        private static void OnPress(string device, int button, string name)
        {
            if (_capInput == PairInput)
            {
                if (!CougarBindStore.Pair(_capProfile, device)) { Report("invalid", null, null); return; }
                Plugin.Log?.LogInfo($"[NOXMFD] Cougar profile '{_capProfile}' paired with '{name}'.");
                Finish("paired");
                return;
            }
            switch (CougarBindStore.Bind(_capProfile, _capInput, device, button, false, out var owner))
            {
                case CougarBindResult.Bound:
                    Plugin.Log?.LogInfo($"[NOXMFD] Cougar '{_capProfile}' {_capInput} = '{name}' button {button}.");
                    Finish("bound");
                    break;
                case CougarBindResult.Conflict:
                    Report("conflict", owner, (device, button));
                    break;
                case CougarBindResult.OtherDevice:
                    Report("other-device", null, null);
                    break;
                default:
                    Report("invalid", null, null);
                    break;
            }
        }

        // A capture result the wizard acts on, capture still armed (conflict, other frame).
        private static void Report(string result, (string, string)? owner, (string, int)? pending)
        {
            _capResult = result;
            _capOwner = owner;
            _capPending = pending;
            _capSeq++;
            _stateDirty = true;
        }

        // A capture that succeeded: report it and disarm.
        private static void Finish(string result)
        {
            string? profile = _capProfile, input = _capInput;
            Cancel();
            _capResult = result;
            _capSeq++;
            _lastDone = (profile ?? string.Empty, input ?? string.Empty);
            _stateDirty = true;
        }
        private static (string Profile, string Input) _lastDone = (string.Empty, string.Empty);

        private static void MarkHeldSilently(Live live)
        {
            IList<Joystick> joys = ReInput.isReady ? ReInput.controllers.Joysticks : Array.Empty<Joystick>();
            if (live.Joy < 0 || live.Joy >= joys.Count) return;
            Joystick joy = joys[live.Joy];
            for (int i = 0; i < live.Binds.Length; i++)
                live.Held[i] = live.Binds[i].Button < joy.buttonCount && joy.GetButton(live.Binds[i].Button);
        }

        // ── state ────────────────────────────────────────────────────────────────────────────

        // {"profiles":[...CougarBindStore...],"live":{"connected":{"LEFT":true},"bgInput":bool,
        //  "capture":{"profile","input","result","seq","owner":{"profile","input"},"done":{"profile","input"}}}}
        private static string BuildState()
        {
            string store = CougarBindStore.StateJson;   // {"profiles":[...]}
            var sb = new StringBuilder(store, 0, store.Length - 1, store.Length + 256);
            sb.Append(",\"live\":{\"connected\":{");
            bool first = true;
            foreach (Live live in _live)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append('"').Append(JsonLite.EscapeJson(live.Profile)).Append("\":").Append(live.Joy >= 0 ? "true" : "false");
            }
            sb.Append("},\"bgInput\":").Append(Keybinds.BackgroundInput ? "true" : "false");
            sb.Append(",\"capture\":{\"profile\":\"").Append(JsonLite.EscapeJson(_capProfile ?? string.Empty))
              .Append("\",\"input\":\"").Append(JsonLite.EscapeJson(_capInput ?? string.Empty))
              .Append("\",\"result\":\"").Append(_capResult)
              .Append("\",\"seq\":").Append(_capSeq);
            if (_capOwner.HasValue)
                sb.Append(",\"owner\":{\"profile\":\"").Append(JsonLite.EscapeJson(_capOwner.Value.Profile))
                  .Append("\",\"input\":\"").Append(JsonLite.EscapeJson(_capOwner.Value.Input)).Append("\"}");
            sb.Append(",\"done\":{\"profile\":\"").Append(JsonLite.EscapeJson(_lastDone.Profile))
              .Append("\",\"input\":\"").Append(JsonLite.EscapeJson(_lastDone.Input)).Append("\"}");
            return sb.Append("}}}").ToString();
        }
    }
}

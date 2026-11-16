using System.Collections.Generic;
using System.Text;

namespace NOXMFD
{
    // The pure parts of reading Cougar frames (CougarFrames.cs does the Rewired side). BCL-only, so
    // tools/tests checks them without the game.
    internal static class CougarFrameLogic
    {
        // Which connected device (0-based, in Rewired order) a profile's saved identity is now, or -1.
        // By instance GUID first. Without a GUID match it falls back to the device name only when
        // exactly one connected device has that name: with two identical frames a name can't say which
        // is which, and guessing would drive the wrong window, so that frame waits to be re-paired.
        internal static int Find(string identity, IList<(string Guid, string Name)> joys)
        {
            int bar = identity.IndexOf('|');
            if (bar < 0) return -1;
            string guid = identity.Substring(0, bar), name = identity.Substring(bar + 1);
            if (guid.Length > 0)
                for (int i = 0; i < joys.Count; i++)
                    if (joys[i].Guid == guid) return i;
            int found = -1;
            for (int i = 0; i < joys.Count; i++)
            {
                if (joys[i].Name != name) continue;
                if (found >= 0) return -1;   // two of this model: ambiguous
                found = i;
            }
            return found;
        }
    }

    // Frame presses and releases on their way to the browsers: the poller appends on the main thread,
    // every SSE connection reads what it hasn't sent yet on its own thread. Numbered, so a press and
    // its release that both land between two SSE ticks still arrive as two events, in order. Bounded:
    // a connection that falls more than Capacity events behind skips to the oldest still held.
    internal sealed class CougarPressLog
    {
        internal const int Capacity = 128;
        private readonly (long Seq, string Profile, string Input, bool Down)[] _ring = new (long, string, string, bool)[Capacity];
        private long _head;   // seq of the newest event; 0 = none yet
        private readonly object _lock = new object();

        internal long Head { get { lock (_lock) return _head; } }

        internal void Add(string profile, string input, bool down)
        {
            lock (_lock)
            {
                _head++;
                _ring[_head % Capacity] = (_head, profile, input, down);
            }
        }

        // The events after `lastSeq` as a JSON array of {"seq","profile","input","down"}, advancing
        // `lastSeq`; null when there are none.
        internal string? JsonSince(ref long lastSeq)
        {
            lock (_lock)
            {
                if (_head <= lastSeq) return null;
                long from = System.Math.Max(lastSeq + 1, _head - Capacity + 1);
                var sb = new StringBuilder("[");
                for (long s = from; s <= _head; s++)
                {
                    var e = _ring[s % Capacity];
                    if (s > from) sb.Append(',');
                    sb.Append("{\"seq\":").Append(e.Seq)
                      .Append(",\"profile\":\"").Append(JsonLite.EscapeJson(e.Profile))
                      .Append("\",\"input\":\"").Append(JsonLite.EscapeJson(e.Input))
                      .Append("\",\"down\":").Append(e.Down ? "true" : "false").Append('}');
                }
                lastSeq = _head;
                return sb.Append(']').ToString();
            }
        }
    }
}

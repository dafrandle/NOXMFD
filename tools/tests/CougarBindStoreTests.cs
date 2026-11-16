using System;
using System.Collections.Generic;
using System.IO;
using Xunit;

namespace NOXMFD.Tests
{
    // CougarBindStore: the Cougar frame bindings on the game PC (docs/cougar-mfd.md). Each test points
    // the store at its own empty temp folder.
    public class CougarBindStoreTests : IDisposable
    {
        private readonly string _dir = Path.Combine(Path.GetTempPath(), "noxmfd-cougar-test-" + Guid.NewGuid());
        private const string FrameA = "aaaa|Thrustmaster MFD Cougar";
        private const string FrameB = "bbbb|Thrustmaster MFD Cougar";

        public CougarBindStoreTests()
        {
            Directory.CreateDirectory(_dir);
            CougarBindStore.ConfigDir = _dir;
            CougarBindStore.Load();
        }

        public void Dispose()
        {
            CougarBindStore.ConfigDir = null;
            try { Directory.Delete(_dir, true); } catch { }
        }

        private static CougarBindResult Bind(string profile, string input, string device, int button, bool force = false) =>
            CougarBindStore.Bind(profile, input, device, button, force, out _);

        [Fact]
        public void TwentyEightInputs_FaceKeysThenRockerHalves()
        {
            Assert.Equal(28, CougarBindStore.Inputs.Length);
            Assert.Equal(28, new HashSet<string>(CougarBindStore.Inputs).Count);
            Assert.True(CougarBindStore.IsRocker("tl-"));
            Assert.False(CougarBindStore.IsRocker("T1"));
        }

        [Theory]
        [InlineData("LEFT", "LEFT")]
        [InlineData("LEFT MFD", "LEFT MFD")]
        [InlineData("left", null)]        // the browser upper-cases before it sends
        [InlineData("", null)]
        [InlineData("A/B", null)]
        public void CleanName_AcceptsOnlyTheBrowsersForm(string raw, string? expected) =>
            Assert.Equal(expected, CougarBindStore.CleanName(raw));

        [Fact]
        public void FirstBind_PairsTheProfileToThatFrame()
        {
            Assert.Equal(CougarBindResult.Bound, Bind("LEFT", "T1", FrameA, 0));
            CougarProfile p = CougarBindStore.Find("LEFT")!;
            Assert.Equal(FrameA, p.Device);
            Assert.Equal(0, p.Binds["T1"]);
        }

        [Fact]
        public void ButtonOnAnotherFrame_IsRefusedOnceTheProfileHasBinds()
        {
            Bind("LEFT", "T1", FrameA, 0);
            Assert.Equal(CougarBindResult.OtherDevice, Bind("LEFT", "T2", FrameB, 1));
            Assert.False(CougarBindStore.Find("LEFT")!.Binds.ContainsKey("T2"));
        }

        [Fact]
        public void AButtonAlreadyBound_IsAConflictUnlessForced()
        {
            Bind("LEFT", "T1", FrameA, 4);
            Assert.Equal(CougarBindResult.Conflict, CougarBindStore.Bind("LEFT", "T2", FrameA, 4, false, out var owner));
            Assert.Equal(("LEFT", "T1"), owner!.Value);
            Assert.Equal(CougarBindResult.Bound, Bind("LEFT", "T2", FrameA, 4, force: true));
            CougarProfile p = CougarBindStore.Find("LEFT")!;
            Assert.False(p.Binds.ContainsKey("T1"));   // moved
            Assert.Equal(4, p.Binds["T2"]);
        }

        [Fact]
        public void RebindingTheSameInputToItsOwnButton_IsNotAConflict()
        {
            Assert.Equal(CougarBindResult.Bound, Bind("LEFT", "T1", FrameA, 4));
            Assert.Equal(CougarBindResult.Bound, Bind("LEFT", "T1", FrameA, 4));
        }

        [Fact]
        public void TwoIdenticalFrames_KeepTheirOwnButtons()
        {
            Assert.Equal(CougarBindResult.Bound, Bind("LEFT", "T1", FrameA, 0));
            Assert.Equal(CougarBindResult.Bound, Bind("RIGHT", "T1", FrameB, 0));   // same button number, other frame: no conflict
        }

        [Fact]
        public void RePair_KeepsEveryButton()
        {
            Bind("LEFT", "T1", FrameA, 0);
            Bind("LEFT", "tl-", FrameA, 20);
            Assert.True(CougarBindStore.Pair("LEFT", "cccc|Thrustmaster MFD Cougar"));
            CougarProfile p = CougarBindStore.Find("LEFT")!;
            Assert.Equal("cccc|Thrustmaster MFD Cougar", p.Device);
            Assert.Equal(2, p.Binds.Count);
        }

        [Fact]
        public void Set_UndoesAndRedoes_WithoutTouchingThePairing()
        {
            Bind("LEFT", "T1", FrameA, 3);
            Assert.True(CougarBindStore.Set("LEFT", "T1", -1));
            Assert.False(CougarBindStore.Find("LEFT")!.Binds.ContainsKey("T1"));
            Assert.True(CougarBindStore.Set("LEFT", "T1", 3));
            Assert.Equal(3, CougarBindStore.Find("LEFT")!.Binds["T1"]);
            Assert.Equal(FrameA, CougarBindStore.Find("LEFT")!.Device);
        }

        [Fact]
        public void BadInput_IsInvalid()
        {
            Assert.Equal(CougarBindResult.Invalid, Bind("LEFT", "T9", FrameA, 0));
            Assert.Equal(CougarBindResult.Invalid, Bind("LEFT", "T1", "", 0));
            Assert.Equal(CougarBindResult.Invalid, Bind("LEFT", "T1", FrameA, -1));
            Assert.Equal(CougarBindResult.Invalid, Bind("left", "T1", FrameA, 0));
            Assert.False(CougarBindStore.Set("LEFT", "nope", 1));
        }

        [Fact]
        public void Bindings_SurviveAReload_AndClearForgetsTheProfile()
        {
            Bind("LEFT", "T1", FrameA, 0);
            Bind("LEFT", "br+", FrameA, 27);
            Bind("RIGHT", "B3", FrameB, 9);
            CougarBindStore.Load();
            Assert.Equal(27, CougarBindStore.Find("LEFT")!.Binds["br+"]);
            Assert.Equal(FrameB, CougarBindStore.Find("RIGHT")!.Device);
            Assert.True(CougarBindStore.Clear("LEFT"));
            CougarBindStore.Load();
            Assert.Null(CougarBindStore.Find("LEFT"));
            Assert.NotNull(CougarBindStore.Find("RIGHT"));
        }

        [Fact]
        public void StateJson_ListsProfilesDeviceNameAndBinds()
        {
            Bind("LEFT", "T1", FrameA, 2);
            var root = (Dictionary<string, object?>)JsonLite.Parse(CougarBindStore.StateJson)!;
            var p = (Dictionary<string, object?>)((List<object?>)root["profiles"]!)[0]!;
            Assert.Equal("LEFT", p["name"]);
            Assert.Equal("Thrustmaster MFD Cougar", p["deviceName"]);
            Assert.Equal(2.0, ((Dictionary<string, object?>)p["binds"]!)["T1"]);
        }

        [Fact]
        public void AnUnreadableFile_StartsEmpty()
        {
            File.WriteAllText(Path.Combine(_dir, "com.roque.NOXMFD.cougar.json"), "{ not json");
            CougarBindStore.Load();
            Assert.Empty(CougarBindStore.Profiles);
        }
    }

    public class CougarFrameLogicTests
    {
        private static readonly (string Guid, string Name)[] TwoFrames =
            { ("aaaa", "Thrustmaster MFD Cougar"), ("bbbb", "Thrustmaster MFD Cougar"), ("cccc", "T.16000M") };

        [Fact]
        public void Find_ByGuid() =>
            Assert.Equal(1, CougarFrameLogic.Find("bbbb|Thrustmaster MFD Cougar", TwoFrames));

        [Fact]
        public void Find_TwoIdenticalFramesAndAnUnknownGuid_IsAmbiguous() =>
            Assert.Equal(-1, CougarFrameLogic.Find("zzzz|Thrustmaster MFD Cougar", TwoFrames));

        [Fact]
        public void Find_OneFrameOfThatModel_FallsBackToTheName() =>
            Assert.Equal(2, CougarFrameLogic.Find("zzzz|T.16000M", TwoFrames));

        [Fact]
        public void Find_NotConnectedOrUnparseable()
        {
            Assert.Equal(-1, CougarFrameLogic.Find("zzzz|Other", TwoFrames));
            Assert.Equal(-1, CougarFrameLogic.Find("", TwoFrames));
        }

        [Fact]
        public void PressLog_DeliversEachEventOnceInOrder()
        {
            var log = new CougarPressLog();
            long seen = log.Head;
            Assert.Null(log.JsonSince(ref seen));
            log.Add("LEFT", "T1", true);
            log.Add("LEFT", "T1", false);
            string json = log.JsonSince(ref seen)!;
            var list = (List<object?>)JsonLite.Parse(json)!;
            Assert.Equal(2, list.Count);
            Assert.Equal(true, ((Dictionary<string, object?>)list[0]!)["down"]);
            Assert.Equal(false, ((Dictionary<string, object?>)list[1]!)["down"]);
            Assert.Null(log.JsonSince(ref seen));   // nothing new
        }

        [Fact]
        public void PressLog_AReaderTooFarBehind_SkipsToTheOldestHeld()
        {
            var log = new CougarPressLog();
            long seen = 0;
            for (int i = 0; i < CougarPressLog.Capacity + 10; i++) log.Add("LEFT", "T1", i % 2 == 0);
            var list = (List<object?>)JsonLite.Parse(log.JsonSince(ref seen)!)!;
            Assert.Equal(CougarPressLog.Capacity, list.Count);
            Assert.Equal((double)(CougarPressLog.Capacity + 10), ((Dictionary<string, object?>)list[list.Count - 1]!)["seq"]);
        }
    }
}

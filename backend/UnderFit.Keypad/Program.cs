using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

// Receives device-tagged keypad events only while Under-Fit is foreground.
// It never hooks other applications, saves keystrokes or sends network traffic.
internal static class Program
{
    private const uint Input = 0x00FF;
    private static readonly WindowProc Callback = HandleMessage;
    private static uint parent;
    private static readonly Dictionary<IntPtr, string> Names = [];
    private static void Main(string[] args)
    {
        parent = uint.Parse(args[0]);
        var instance = GetModuleHandle(null);
        var cls = new WindowClass { Proc = Callback, Instance = instance, Name = "UnderFitKeypadInput" };
        if (RegisterClass(ref cls) == 0) throw new InvalidOperationException("No se pudo registrar el lector USB.");
        var window = CreateWindowEx(0, cls.Name, "", 0, 0, 0, 0, 0, new IntPtr(-3), IntPtr.Zero, instance, IntPtr.Zero);
        var devices = new[] { new RawDevice { UsagePage = 1, Usage = 6, Flags = 0x100, Target = window } };
        if (!RegisterRawInputDevices(devices, 1, (uint)Marshal.SizeOf<RawDevice>()))
            throw new InvalidOperationException("No se pudo iniciar el lector USB.");
        Console.WriteLine("{\"ready\":true}");
        while (GetMessage(out var message, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref message); DispatchMessage(ref message);
        }
    }
    private static IntPtr HandleMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam)
    {
        if (message == Input)
        {
            GetWindowThreadProcessId(GetForegroundWindow(), out var process);
            if (process == parent) Read(lparam);
        }
        return DefWindowProc(window, message, wparam, lparam);
    }
    private static void Read(IntPtr handle)
    {
        uint length = 0, headerSize = (uint)Marshal.SizeOf<RawHeader>();
        if (GetRawInputData(handle, 0x10000003, IntPtr.Zero, ref length, headerSize) == uint.MaxValue) return;
        var buffer = Marshal.AllocHGlobal((int)length);
        try
        {
            if (GetRawInputData(handle, 0x10000003, buffer, ref length, headerSize) == uint.MaxValue) return;
            var header = Marshal.PtrToStructure<RawHeader>(buffer);
            if (header.Type != 1 || header.Device == IntPtr.Zero) return;
            var key = Marshal.PtrToStructure<RawKeyboard>(buffer + (int)headerSize);
            var extended = (key.Flags & 2) != 0;
            string? digit = !extended ? key.Scan switch {
                0x52 => "0", 0x4F => "1", 0x50 => "2", 0x51 => "3", 0x4B => "4",
                0x4C => "5", 0x4D => "6", 0x47 => "7", 0x48 => "8", 0x49 => "9",
                0x53 => "backspace", _ => null } : key.Scan == 0x1C ? "enter" : null;
            if (digit is null) return;
            if (!Names.TryGetValue(header.Device, out var name))
            {
                uint chars = 0;
                GetRawInputDeviceInfo(header.Device, 0x20000007, null, ref chars);
                var text = new StringBuilder((int)chars + 1);
                if (GetRawInputDeviceInfo(header.Device, 0x20000007, text, ref chars) == uint.MaxValue) return;
                Names[header.Device] = name = text.ToString();
            }
            string normal = key.VirtualKey switch {
                >= 0x60 and <= 0x69 => (key.VirtualKey - 0x60).ToString(),
                0x0D => "Enter", 0x6E => ".", 0x24 => "Home", 0x23 => "End",
                0x25 => "Left", 0x26 => "Up", 0x27 => "Right", 0x28 => "Down",
                0x21 => "PageUp", 0x22 => "PageDown", 0x2D => "Insert", 0x2E => "Delete",
                0x0C => "Clear", _ => digit };
            Console.WriteLine(JsonSerializer.Serialize(new { device = name, digit, key = normal,
                down = (key.Flags & 1) == 0, control = (GetKeyState(0x11) & 0x8000) != 0,
                shift = (GetKeyState(0x10) & 0x8000) != 0, alt = (GetKeyState(0x12) & 0x8000) != 0 }));
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    private delegate IntPtr WindowProc(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WindowClass { public uint Style; public WindowProc Proc; public int ClassExtra, WindowExtra; public IntPtr Instance, Icon, Cursor, Background; public string? Menu; public string Name; }
    [StructLayout(LayoutKind.Sequential)] private struct RawDevice { public ushort UsagePage, Usage; public uint Flags; public IntPtr Target; }
    [StructLayout(LayoutKind.Sequential)] private struct RawHeader { public uint Type, Size; public IntPtr Device, Wparam; }
    [StructLayout(LayoutKind.Sequential)] private struct RawKeyboard { public ushort Scan, Flags, Reserved, VirtualKey; public uint Message, Extra; }
    [StructLayout(LayoutKind.Sequential)] private struct Message { public IntPtr Window; public uint Id; public IntPtr Wparam, Lparam; public uint Time; public int X, Y; public uint Private; }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern ushort RegisterClass(ref WindowClass cls);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr CreateWindowEx(uint style, string cls, string title, uint flags, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr data);
    [DllImport("user32.dll")] private static extern bool RegisterRawInputDevices(RawDevice[] devices, uint count, uint size);
    [DllImport("user32.dll")] private static extern uint GetRawInputData(IntPtr input, uint command, IntPtr data, ref uint size, uint header);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern uint GetRawInputDeviceInfo(IntPtr device, uint command, StringBuilder? data, ref uint size);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll")] private static extern short GetKeyState(int key);
    [DllImport("user32.dll")] private static extern int GetMessage(out Message msg, IntPtr window, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message msg);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref Message msg);
    [DllImport("user32.dll")] private static extern IntPtr DefWindowProc(IntPtr window, uint msg, IntPtr wp, IntPtr lp);
}

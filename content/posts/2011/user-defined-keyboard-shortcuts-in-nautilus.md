---
title: User-defined keyboard shortcuts in Nautilus
date: 2011-02-18
aliases: ['/2011/02/18/user-defined-keyboard-shortcuts-in-nautilus.html']
---

In this post I describe how to add arbitrary keyboard shortcuts to the
[Nautilus](http://live.gnome.org/Nautilus) file manager using its
[extension API](http://projects.gnome.org/nautilus-python/). I really
like Nautilus, it has a clean interface and lots of features under the
hood. One of the things I was missing coming from the world of [orthodox
file managers](http://en.wikipedia.org/wiki/File_manager#Orthodox_file_managers)
was an embedded terminal which can be shown/hidden with a simple
keyboard shorcut. Recently there appeared an extension called [Nautilus
Terminal](http://software.flogisoft.com/nautilus-terminal/en/) that
provides exactly this. It is quite good and I highly recommend to give
it a try. However I was not entirely satisfied with it because of
inability to use some usual shortcuts such as `Ctrl+L`, although you can
use `Ctrl+Shift+L` instead. Also if you change a directory in Nautilus
the embedded terminal is closed and a new one is opened in a new
location. So you can\'t really have anything running in a terminal and
at the same time browse the directories.

After some googling I\'ve found another nice extension called
[nautilus-open-terminal](
http://packages.ubuntu.com/maverick/nautilus-open-terminal)
which allows to open a terminal through a context menu. It is not bad
but I would prefer a keyboard shortcut instead of the context menu.
After some experiments I\'ve found a hackish way to implement this by
(ab)using [LocationWidgetProvider](
http://projects.gnome.org/nautilus-python/documentation/html/class-nautilus-python-location-widget-provider.html).
If you know a better way please tell me about it in the comments section
below.

So here is a Python script that does the trick:

```python
import gconf, gtk, nautilus, os, pipes, urllib
    
TERMINAL_KEY = '/desktop/gnome/applications/terminal/exec'
    
class ShortcutProvider(nautilus.LocationWidgetProvider):
    def __init__(self):
        self.client = gconf.client_get_default()
        self.accel_group = gtk.AccelGroup()
        self.accel_group.connect_group(
            ord('o'), gtk.gdk.CONTROL_MASK, gtk.ACCEL_VISIBLE,
            self.run_terminal)
        self.window = None
    
    def run_terminal(self, accel_group, acceleratable,
                        keyval, modifier):
        filename = urllib.unquote(self.uri[7:])
        terminal = self.client.get_string(TERMINAL_KEY)
        os.chdir(filename)
        os.system(pipes.quote(terminal) + ' &')
        return True
    
    def get_widget(self, uri, window):
        self.uri = uri
        if self.window:
            self.window.remove_accel_group(self.accel_group)
        window.add_accel_group(self.accel_group)
        self.window = window
        return None
```

To enable this extension first install the python-nautilus package
(`sudo apt-get install python-nautilus` in Ubuntu), then copy the script
to the extensions install path, e.g. `~/.nautilus/python-extensions/`
and restart nautilus with the `nautilus -q` command. This script
redefines the `Ctrl+O` shortcut to open a terminal. It can be easily
adjusted to use a different key combination or to define several
shortcuts with different actions. For example [this
script](https://github.com/vitaut/captain-nemo/raw/master/misc/shortcut.py)
defines `Ctrl+O` to open a terminal and `Ctrl-G` to open gitg in the
current directory of Nautilus. It also adds Compare... to the context
menu when two files are selected.

**Update:** I\'ve ported the script to Nautilus 3. The new version can
be downloaded from [here](
https://github.com/vitaut/captain-nemo/raw/master/misc/shortcut-nautilus3.py).
Note that the script requires at least version 1.0-0ubuntu2 of the
python-nautilus package.

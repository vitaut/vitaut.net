---
title: Ubuntu on a SONY VAIO VPCS11J7E laptop
date: 2011-12-08
aliases: ['/2011/12/08/ubuntu-on-a-sony-vaio-vpcs11j7e-laptop.html']
---

Today I finally got my SONY VAIO VPCS11J7E laptop delivered after a
warranty repair. They replaced a few parts and thoroughly cleaned the
laptop. Now it looks as new apart from a small crack on flimsy plastic
around the hinges (I rejected their generous offer to replace the
plastic for 200 quid.)

I immediately wiped out Windows 7 and (other) junkware that they had put
on my laptop eating up a huge chunk of my precious SSD space, and
installed [Ubuntu](https://wiki.ubuntu.com) Oneiric Ocelot. Due to this
rare opportunity of having a fresh install of Ubuntu I decided to do
some tests to see how well this laptop\'s hardware is supported in this
OS both out of the box and with additional drivers. So I ran the
complete set of tests from the [System
Testing](https://launchpad.net/checkbox) utility. The full report is
available [here](/files/test-results/report.html).

As you can see from [the test results](/files/test-results/report.html)
most laptop\'s hardware is supported out of the box. It includes
graphics that works both with open source and proprietary drivers,
networking, camera, card reader, etc. So I will only focus on the few
things that are not working and how to fix them. Note that although
optical drive test fails the drive itself works perfectly. However the
default disk burning software
([Brasero](http://projects.gnome.org/brasero//index.html)) has some
problems with it, like being unable to eject disks. So I recommend using
[K3b](http://www.k3b.org/) instead.

**Microphone**

To get rid of the annoying cracking noise reported
[here](https://bugs.launchpad.net/ubuntu/+source/alsa-driver/+bug/787410)
add the following line to `/etc/modprobe.d/alsa-base.conf`:

```
options snd-hda-intel position_fix=2
```

Now restart the system and enjoy the clear sound of your voice.

**Brightness control**

Download the latest version of the
[nvidiabl](https://github.com/guillaumezin/nvidiabl) driver (version
0.72 of the driver is available [here](
https://github.com/downloads/guillaumezin/nvidiabl/nvidiabl-dkms_0.72_all.deb))
and install it:

```
$ sudo dpkg -i nvidiabl-dkms_0.72_all.deb
```

It enables the control of laptop backlight connected to NVIDIA chip
using the `/sys/class/backlight` interface.

To make the brightness control Fn keys work get the required scripts
from [nvidiabl](https://github.com/guillaumezin/nvidiabl) repository and
copy them to `/etc`:

```
$ git clone https://github.com/guillaumezin/nvidiabl.git
$ sudo cp -R nvidiabl/scripts/etc/* /etc
```

**External monitor**

To enable external monitor with proprietary NVIDIA drivers:

1.  Open NVIDIA X Server Settings.
2.  Go to \"X Server Display Configuration\".
3.  Click \"Detect Displays\".
4.  Select the external display and choose TwinView in
    \"Configuration\".
5.  Click Apply.
6.  Click \"Save to X Configuration File\" if you want to make this
    configuration permanent.

![](/img/twin-view.png)

Alternatively set the following options in the Screen section of
`/etc/X11/xorg.conf` and restart the X server:

```
Section "Screen"
    ...
    Option "TwinView" "1"
    Option "TwinViewXineramaInfoOrder" "DFP-0"
    Option "metamodes" "DFP: nvidia-auto-select +0+0, CRT: nvidia-auto-select +1366+0"
    ...
EndSection
```

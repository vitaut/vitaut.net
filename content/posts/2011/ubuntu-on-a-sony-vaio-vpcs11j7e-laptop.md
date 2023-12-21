---
title: Ubuntu on a SONY VAIO VPCS11J7E laptop
date: 2011-12-08
aliases: ['/2011/12/08/ubuntu-on-a-sony-vaio-vpcs11j7e-laptop.html']
---

<p>Today I finally got my SONY VAIO VPCS11J7E laptop delivered after a
warranty repair. They replaced a few parts and thoroughly cleaned the laptop.
Now it looks as new apart from a small crack on flimsy plastic around the
hinges (I rejected their generous offer to replace the plastic for 200
quid.)</p>

<p>I immediately wiped out Windows 7 and (other) junkware that they had put
on my laptop eating up a huge chunk of my precious SSD space, and installed
<a href="https://wiki.ubuntu.com">Ubuntu</a> Oneiric Ocelot. Due to this rare
opportunity of having a fresh install of Ubuntu I decided to do some tests to
see how well this laptop's hardware is supported in this OS both out of the
box and with additional drivers. So I ran the complete set of tests from the
<a href="https://launchpad.net/checkbox">System Testing</a> utility. The full
report is available <a href=
"/files/test-results/report.html">here</a>.</p>

<p>As you can see from <a href="/files/test-results/report.html">the test results</a> most
laptop's hardware is supported out of the box. It includes graphics that
works both with open source and proprietary drivers, networking, camera, card
reader, etc. So I will only focus on the few things that are not working and
how to fix them. Note that although optical drive test fails the drive itself
works perfectly. However the default disk burning software (<a href=
"http://projects.gnome.org/brasero//index.html">Brasero</a>) has some
problems with it, like being unable to eject disks. So I recommend using
<a href="http://www.k3b.org/">K3b</a> instead.</p><strong>Microphone</strong>

<p>To get rid of the annoying cracking noise reported <a href=
"https://bugs.launchpad.net/ubuntu/+source/alsa-driver/+bug/787410">here</a>
add the following line to <code>/etc/modprobe.d/alsa-base.conf</code>:</p>

<pre>
options snd-hda-intel position_fix=2
</pre>

<p>Now restart the system and enjoy the clear sound of your voice.</p>

<strong>Brightness control</strong>

<p>Download the latest version of the <a href=
"https://github.com/guillaumezin/nvidiabl">nvidiabl</a> driver (version 0.72
of the driver is available <a href=
"https://github.com/downloads/guillaumezin/nvidiabl/nvidiabl-dkms_0.72_all.deb">
here</a>) and install it:</p>

<pre class="terminal"><code>$ sudo dpkg -i nvidiabl-dkms_0.72_all.deb</code></pre>
It enables the control of laptop backlight connected to NVIDIA chip using
the <code>/sys/class/backlight</code> interface.

<p>To make the brightness control Fn keys work get the required scripts from
<a href="https://github.com/guillaumezin/nvidiabl">nvidiabl</a> repository
and copy them to <code>/etc</code>:</p>
<pre class="terminal">
<code>$ git clone https://github.com/guillaumezin/nvidiabl.git
$ sudo cp -R nvidiabl/scripts/etc/* /etc
</code></pre>

<p><strong>External monitor</strong></p>

<p>To enable external monitor with proprietary NVIDIA drivers:</p>

<ol>
  <li>Open NVIDIA X Server Settings.</li>
  <li>Go to "X Server Display Configuration".</li>
  <li>Click "Detect Displays".</li>
  <li>Select the external display and choose TwinView in
  "Configuration".</li>
  <li>Click Apply.</li>
  <li>Click "Save to X Configuration File" if you want to make this
  configuration permanent.</li>
</ol>

<div style="clear: both; text-align: center;">
  <img height="400" src="/img/twin-view.png" width="392">
</div>

Alternatively set the following options in the Screen section of
<code>/etc/X11/xorg.conf</code> and restart the X server:

<pre>
Section "Screen"
    ...
    Option "TwinView" "1"
    Option "TwinViewXineramaInfoOrder" "DFP-0"
    Option "metamodes" "DFP: nvidia-auto-select +0+0, CRT: nvidia-auto-select +1366+0"
    ...
EndSection
</pre>

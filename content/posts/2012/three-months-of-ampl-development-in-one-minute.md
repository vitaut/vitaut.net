---
title: Three months of AMPL development in one minute
date: 2012-08-13
aliases: ['/2012/08/13/three-months-of-ampl-development-in-one-minute.html']
---

It's been three month since I created the [AMPL GitHub repository](
https://github.com/vitaut/ampl) which is based on AMPL material from Netlib with
[some changes](https://github.com/vitaut/ampl/wiki). The following video shows
the change history:

{{< youtube Dlt50vevmuY >}}

The video was created using [Gource](http://code.google.com/p/gource/):

```
$ gource -1280x720 --title AMPL --hide filenames,mouse \
    --seconds-per-day 0.55 --date-format "%Y-%m-%d" -o - | \
    ffmpeg -y -r 60 -f image2pipe -vcodec ppm -i - -vcodec \
    libx264 -preset ultrafast -crf 1 -threads 0 -bf 0 ampl.mp4
$ mp3cut -o track.mp3 -t 00:00:00+000-00:01:01+000 \
    Constancy\ Part\ Two.mp3
$ ffmpeg -i ampl.mp4 -vcodec copy -i track.mp3 -acodec copy \
    ampl-final.mp4 -newaudio
```

Music track is Constancy Part Two from the [collection of royalty-free music
by Kevin MacLeod](http://incompetech.com/m/c/royalty-free/).

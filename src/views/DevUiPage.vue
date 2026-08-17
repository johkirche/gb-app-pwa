<template>
    <!-- Ionic's structure.css locks body scrolling, so this page owns its scroll area. -->
    <div class="h-full overflow-y-auto bg-background text-foreground">
        <main class="mx-auto w-full max-w-3xl px-5 pb-28 pt-14 sm:px-8 sm:pt-20">
            <!-- ================= Kopf ================= -->
            <header class="text-center">
                <p class="label-micro text-gold">Design-System</p>
                <h1 class="mt-3 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                    Gesangbuch
                </h1>
                <p class="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                    Der visuelle Grundton der neuen Anwendung: warmes Papier, Kirchenblau und
                    sparsames Gold. Prüfen Sie Palette und Komponenten bitte in beiden Farbwelten —
                    am Telefon und am Schreibtisch.
                </p>
                <div class="mt-7 flex justify-center">
                    <ToggleGroup
                        type="single"
                        aria-label="Farbschema wählen"
                        :model-value="theme"
                        @update:model-value="onThemeChange"
                    >
                        <ToggleGroupItem value="light">Hell</ToggleGroupItem>
                        <ToggleGroupItem value="dark">Dunkel</ToggleGroupItem>
                        <ToggleGroupItem value="system">System</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <div class="rule-flourish mx-auto mt-12 max-w-xs text-[10px]" aria-hidden="true">
                    ✦
                </div>
            </header>

            <!-- ================= Palette ================= -->
            <section class="mt-20">
                <div class="flex items-center gap-4">
                    <h2 class="shrink-0 font-display text-2xl font-semibold">Palette</h2>
                    <Separator class="flex-1" />
                    <span class="label-micro shrink-0 text-muted-foreground">01</span>
                </div>
                <p class="mt-2 text-sm text-muted-foreground">
                    Alle Farben sind semantische Token und wechseln automatisch mit dem Farbschema.
                </p>
                <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    <div
                        v-for="swatch in swatches"
                        :key="swatch.token"
                        class="overflow-hidden rounded-lg border"
                    >
                        <div class="flex h-16 items-end px-3 pb-2" :class="swatch.classes">
                            <span class="font-display text-xl italic leading-none">Aa</span>
                        </div>
                        <div class="border-t bg-card px-3 py-2">
                            <p class="text-xs font-medium">{{ swatch.label }}</p>
                            <p class="text-[11px] text-muted-foreground">{{ swatch.token }}</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ================= Typografie ================= -->
            <section class="mt-20">
                <div class="flex items-center gap-4">
                    <h2 class="shrink-0 font-display text-2xl font-semibold">Typografie</h2>
                    <Separator class="flex-1" />
                    <span class="label-micro shrink-0 text-muted-foreground">02</span>
                </div>
                <div class="mt-8 space-y-10">
                    <div>
                        <p class="label-micro text-muted-foreground">
                            Display · Cormorant Garamond
                        </p>
                        <p
                            class="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl"
                        >
                            Großer Gott, wir loben dich
                        </p>
                        <p class="mt-2 font-display text-2xl leading-snug text-muted-foreground">
                            Nun danket alle Gott, mit Herzen, Mund und Händen
                        </p>
                    </div>
                    <div>
                        <p class="label-micro text-muted-foreground">Fließtext · Albert Sans</p>
                        <p class="mt-3 max-w-prose text-[15px] leading-relaxed">
                            Dieses Gesangbuch begleitet Sie durch das Kirchenjahr. Die Gestaltung
                            bleibt bewusst ruhig und editorial: feine Linien statt schwerer Kästen,
                            eine Serifenschrift für alles Gesungene — damit die Lieder selbst im
                            Mittelpunkt stehen.
                        </p>
                    </div>
                    <div class="flex flex-wrap items-end gap-x-14 gap-y-8">
                        <div>
                            <p class="label-micro text-muted-foreground">Micro-Label</p>
                            <p class="label-micro mt-3 text-gold">Lob &amp; Dank</p>
                        </div>
                        <div>
                            <p class="label-micro text-muted-foreground">Liednummer</p>
                            <p class="number-display mt-2 text-5xl leading-none">142</p>
                        </div>
                    </div>
                    <div class="rule-flourish text-[10px]" aria-hidden="true">✦</div>
                </div>
            </section>

            <!-- ================= Liedliste (Vorschau) ================= -->
            <section class="mt-20">
                <div class="flex items-center gap-4">
                    <h2 class="shrink-0 font-display text-2xl font-semibold">
                        Liedliste
                        <span class="text-muted-foreground">(Vorschau)</span>
                    </h2>
                    <Separator class="flex-1" />
                    <span class="label-micro shrink-0 text-muted-foreground">03</span>
                </div>
                <p class="mt-2 text-sm text-muted-foreground">
                    So werden Rubriken und Lieder künftig gesetzt — bitte besonders aufmerksam
                    prüfen.
                </p>

                <div class="mt-8">
                    <div class="flex items-center gap-3 px-2">
                        <h3 class="label-micro shrink-0 text-gold">Lob &amp; Dank</h3>
                        <Separator class="flex-1" />
                    </div>
                    <ul class="mt-1 divide-y divide-border">
                        <li v-for="song in songs" :key="song.number">
                            <button
                                type="button"
                                class="flex w-full items-baseline gap-5 rounded-sm px-2 py-3.5 text-left transition-colors hover:bg-muted active:bg-muted"
                                @click="toast(`Lied ${song.number} geöffnet.`)"
                            >
                                <span
                                    class="number-display w-10 shrink-0 text-right text-lg leading-none"
                                >
                                    {{ song.number }}
                                </span>
                                <span class="font-display text-[17px] leading-snug">
                                    {{ song.title }}
                                </span>
                            </button>
                        </li>
                    </ul>
                    <Separator />
                </div>

                <Card class="mt-10">
                    <CardContent class="flex items-center gap-6 p-6 sm:gap-9 sm:p-8">
                        <span class="number-display shrink-0 text-6xl leading-none sm:text-7xl">
                            302
                        </span>
                        <div class="min-w-0">
                            <p class="label-micro text-gold">Lied der Woche</p>
                            <h3
                                class="mt-1.5 font-display text-2xl font-semibold leading-tight sm:text-3xl"
                            >
                                Die güldne Sonne
                            </h3>
                            <p class="mt-1.5 text-sm text-muted-foreground">
                                Text: Paul Gerhardt, 1666 · Melodie: Johann Georg Ebeling
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <!-- ================= Schaltflächen ================= -->
            <section class="mt-20">
                <div class="flex items-center gap-4">
                    <h2 class="shrink-0 font-display text-2xl font-semibold">Schaltflächen</h2>
                    <Separator class="flex-1" />
                    <span class="label-micro shrink-0 text-muted-foreground">04</span>
                </div>
                <div class="mt-8 space-y-8">
                    <div>
                        <p class="label-micro text-muted-foreground">Varianten</p>
                        <div class="mt-3 flex flex-wrap items-center gap-3">
                            <Button>Speichern</Button>
                            <Button variant="secondary">Duplizieren</Button>
                            <Button variant="outline">Abbrechen</Button>
                            <Button variant="ghost">Überspringen</Button>
                            <Button variant="destructive">Löschen</Button>
                            <Button variant="link">Mehr erfahren</Button>
                        </div>
                    </div>
                    <div>
                        <p class="label-micro text-muted-foreground">Größen &amp; Symbole</p>
                        <div class="mt-3 flex flex-wrap items-center gap-3">
                            <Button size="lg">Anmelden</Button>
                            <Button>Speichern</Button>
                            <Button size="sm" variant="outline">Filtern</Button>
                            <Button size="icon" variant="outline" aria-label="Suchen">
                                <Search />
                            </Button>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Zu Favoriten hinzufügen"
                            >
                                <Heart />
                            </Button>
                        </div>
                    </div>
                    <div>
                        <p class="label-micro text-muted-foreground">Mit Symbol &amp; Zustand</p>
                        <div class="mt-3 flex flex-wrap items-center gap-3">
                            <Button>
                                <Plus />
                                Neue Playlist
                            </Button>
                            <Button variant="outline">
                                <Download />
                                Herunterladen
                            </Button>
                            <Button disabled>Nicht verfügbar</Button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ================= Formularelemente ================= -->
            <section class="mt-20">
                <div class="flex items-center gap-4">
                    <h2 class="shrink-0 font-display text-2xl font-semibold">Formularelemente</h2>
                    <Separator class="flex-1" />
                    <span class="label-micro shrink-0 text-muted-foreground">05</span>
                </div>
                <div class="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                    <div class="space-y-2">
                        <Label for="dev-playlist-name">Name der Playlist</Label>
                        <Input
                            id="dev-playlist-name"
                            v-model="playlistName"
                            placeholder="z. B. Erntedank 2026"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label for="dev-category">Rubrik</Label>
                        <Select v-model="category">
                            <SelectTrigger id="dev-category" class="w-full">
                                <SelectValue placeholder="Rubrik wählen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="lob">Lob &amp; Dank</SelectItem>
                                <SelectItem value="advent">Advent</SelectItem>
                                <SelectItem value="passion">Passion</SelectItem>
                                <SelectItem value="ostern">Ostern</SelectItem>
                                <SelectItem value="abend">Morgen &amp; Abend</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                        <Label for="dev-show-notes">Noten anzeigen</Label>
                        <Switch id="dev-show-notes" v-model="showSheetMusic" />
                    </div>
                    <div class="flex items-center gap-3">
                        <Checkbox id="dev-only-favorites" v-model="onlyFavorites" />
                        <Label for="dev-only-favorites">Nur Favoriten anzeigen</Label>
                    </div>
                    <div class="space-y-3">
                        <div class="flex items-baseline justify-between">
                            <p class="text-sm font-medium">Textgröße</p>
                            <span class="number-display text-lg leading-none">
                                {{ textSizeLabel }}
                            </span>
                        </div>
                        <Slider
                            v-model="textSize"
                            :min="12"
                            :max="28"
                            :step="1"
                            aria-label="Textgröße"
                        />
                    </div>
                    <div class="space-y-3">
                        <div class="flex items-baseline justify-between">
                            <p class="text-sm font-medium">Nummernbereich</p>
                            <span class="number-display text-lg leading-none">
                                {{ numberRangeLabel }}
                            </span>
                        </div>
                        <Slider
                            v-model="numberRange"
                            :min="1"
                            :max="500"
                            :step="1"
                            aria-label="Nummernbereich"
                        />
                    </div>
                    <div class="space-y-2.5">
                        <p class="text-sm font-medium">Mit Noten</p>
                        <ToggleGroup
                            v-model="notesFilter"
                            type="single"
                            aria-label="Nach Noten filtern"
                        >
                            <ToggleGroupItem value="alle">Alle</ToggleGroupItem>
                            <ToggleGroupItem value="ja">Ja</ToggleGroupItem>
                            <ToggleGroupItem value="nein">Nein</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>
            </section>

            <!-- ================= Overlays ================= -->
            <section class="mt-20">
                <div class="flex items-center gap-4">
                    <h2 class="shrink-0 font-display text-2xl font-semibold">Overlays</h2>
                    <Separator class="flex-1" />
                    <span class="label-micro shrink-0 text-muted-foreground">06</span>
                </div>
                <div class="mt-8 space-y-8">
                    <div>
                        <p class="label-micro text-muted-foreground">Dialoge</p>
                        <div class="mt-3 flex flex-wrap gap-3">
                            <Dialog>
                                <DialogTrigger as-child>
                                    <Button variant="outline">Dialog mit Formular</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Playlist umbenennen</DialogTitle>
                                        <DialogDescription>
                                            Geben Sie der Playlist einen neuen Namen. Die Änderung
                                            wird sofort übernommen.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div class="space-y-2">
                                        <Label for="dev-dialog-name">Name</Label>
                                        <Input
                                            id="dev-dialog-name"
                                            v-model="dialogPlaylistName"
                                            placeholder="z. B. Adventssingen"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <DialogClose as-child>
                                            <Button variant="outline">Abbrechen</Button>
                                        </DialogClose>
                                        <DialogClose as-child>
                                            <Button @click="toast('Playlist umbenannt.')">
                                                Speichern
                                            </Button>
                                        </DialogClose>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <AlertDialog>
                                <AlertDialogTrigger as-child>
                                    <Button variant="outline">Wichtige Abfrage</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Änderungen verwerfen?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Ihre ungespeicherten Änderungen gehen verloren. Dieser
                                            Schritt kann nicht rückgängig gemacht werden.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction @click="toast('Änderungen verworfen.')">
                                            Verwerfen
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <Button variant="outline" @click="demoConfirm">
                                Bestätigung (useConfirm)
                            </Button>
                            <Button variant="outline" @click="demoConfirmDestructive">
                                Löschen bestätigen
                            </Button>
                        </div>
                    </div>

                    <div>
                        <p class="label-micro text-muted-foreground">Flächen von unten</p>
                        <div class="mt-3 flex flex-wrap gap-3">
                            <Drawer>
                                <DrawerTrigger as-child>
                                    <Button variant="outline">Drawer öffnen</Button>
                                </DrawerTrigger>
                                <DrawerContent>
                                    <DrawerHeader>
                                        <DrawerTitle>Der Mond ist aufgegangen</DrawerTitle>
                                        <DrawerDescription>
                                            Matthias Claudius, 1779 · Melodie: Johann Abraham Peter
                                            Schulz
                                        </DrawerDescription>
                                    </DrawerHeader>
                                    <div class="px-4 pb-2 text-center">
                                        <p
                                            class="mx-auto max-w-sm font-display text-lg leading-relaxed"
                                        >
                                            Der Mond ist aufgegangen,
                                            <br />
                                            die goldnen Sternlein prangen
                                            <br />
                                            am Himmel hell und klar;
                                            <br />
                                            der Wald steht schwarz und schweiget,
                                            <br />
                                            und aus den Wiesen steiget
                                            <br />
                                            der weiße Nebel wunderbar.
                                        </p>
                                    </div>
                                    <DrawerFooter>
                                        <DrawerClose as-child>
                                            <Button variant="outline">Schließen</Button>
                                        </DrawerClose>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>

                            <Button variant="outline" @click="actionSheetOpen = true">
                                Action-Sheet öffnen
                            </Button>
                        </div>
                    </div>

                    <div>
                        <p class="label-micro text-muted-foreground">Menüs &amp; Popover</p>
                        <div class="mt-3 flex flex-wrap gap-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger as-child>
                                    <Button variant="outline">Menü</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuLabel>Playlist</DropdownMenuLabel>
                                    <DropdownMenuItem @select="toast('Bearbeiten gewählt.')">
                                        <Pencil />
                                        Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuItem @select="toast('Duplizieren gewählt.')">
                                        <Copy />
                                        Duplizieren
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        @select="toast('Löschen gewählt.')"
                                    >
                                        <Trash2 />
                                        Löschen
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Popover>
                                <PopoverTrigger as-child>
                                    <Button variant="outline">
                                        <Settings2 />
                                        Anzeige
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" class="w-80">
                                    <div class="space-y-5">
                                        <p class="label-micro text-gold">Liedanzeige</p>
                                        <div class="flex items-center justify-between gap-4">
                                            <Label for="dev-notation">Darstellung</Label>
                                            <Select v-model="notation">
                                                <SelectTrigger id="dev-notation" class="w-40">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="noten">Noten</SelectItem>
                                                    <SelectItem value="text">Nur Text</SelectItem>
                                                    <SelectItem value="akkorde">Akkorde</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="flex items-center justify-between gap-4">
                                            <Label for="dev-autoscroll">Automatisch blättern</Label>
                                            <Switch id="dev-autoscroll" v-model="autoScroll" />
                                        </div>
                                        <div class="space-y-3">
                                            <div class="flex items-baseline justify-between">
                                                <p class="text-sm font-medium">Zoom</p>
                                                <span class="number-display leading-none">
                                                    {{ zoomLabel }}
                                                </span>
                                            </div>
                                            <Slider
                                                v-model="zoom"
                                                :min="50"
                                                :max="200"
                                                :step="10"
                                                aria-label="Zoom"
                                            />
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div>
                        <p class="label-micro text-muted-foreground">Hinweise (Toast)</p>
                        <div class="mt-3 flex flex-wrap gap-3">
                            <Button variant="outline" @click="demoToast">Toast anzeigen</Button>
                            <Button variant="outline" @click="demoToastWithAction">
                                Toast mit Aktion
                            </Button>
                        </div>
                    </div>
                </div>

                <ActionSheet
                    v-model:open="actionSheetOpen"
                    title="Großer Gott, wir loben dich"
                    :actions="sheetActions"
                />
            </section>

            <!-- ================= Status ================= -->
            <section class="mt-20">
                <div class="flex items-center gap-4">
                    <h2 class="shrink-0 font-display text-2xl font-semibold">Status</h2>
                    <Separator class="flex-1" />
                    <span class="label-micro shrink-0 text-muted-foreground">07</span>
                </div>
                <div class="mt-8 space-y-10">
                    <div>
                        <div class="flex items-baseline justify-between">
                            <p class="label-micro text-muted-foreground">
                                Fortschritt · Offline-Download
                            </p>
                            <span class="text-sm tabular-nums text-muted-foreground">
                                {{ progressPercent }} %
                            </span>
                        </div>
                        <Progress :model-value="progressValue" class="mt-3" />
                    </div>
                    <div>
                        <p class="label-micro text-muted-foreground">Ladezustand (Skeleton)</p>
                        <div class="mt-4 space-y-4 px-2">
                            <div class="flex items-center gap-5">
                                <Skeleton class="h-5 w-9" />
                                <Skeleton class="h-4 w-2/3" />
                            </div>
                            <div class="flex items-center gap-5">
                                <Skeleton class="h-5 w-9" />
                                <Skeleton class="h-4 w-1/2" />
                            </div>
                            <div class="flex items-center gap-5">
                                <Skeleton class="h-5 w-9" />
                                <Skeleton class="h-4 w-3/5" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <p class="label-micro text-muted-foreground">Spinner</p>
                        <div class="mt-4 flex items-end gap-10 px-2">
                            <Spinner size="sm" />
                            <Spinner />
                            <Spinner size="lg" />
                        </div>
                    </div>
                    <div>
                        <p class="label-micro text-muted-foreground">Badges</p>
                        <div class="mt-4 flex flex-wrap items-center gap-3">
                            <Badge>Neu</Badge>
                            <Badge variant="secondary">Entwurf</Badge>
                            <Badge variant="outline">Kanon</Badge>
                            <Badge variant="destructive">Offline</Badge>
                            <Badge variant="gold">Lied der Woche</Badge>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ================= Fuß ================= -->
            <footer class="mt-24 text-center">
                <div class="rule-flourish mx-auto max-w-xs text-[10px]" aria-hidden="true">✦</div>
                <p class="mt-6 text-xs text-muted-foreground">
                    Nur in der Entwicklungsumgebung sichtbar · /dev/ui
                </p>
            </footer>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
    Copy,
    Download,
    Heart,
    ListPlus,
    Pencil,
    Plus,
    Search,
    Settings2,
    Share2,
    Trash2,
} from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { toast } from 'vue-sonner';

import { useConfirm } from '@/composables/useConfirm';
import { useTheme } from '@/composables/useTheme';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    ActionSheet,
    type ActionSheetAction,
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// --- Farbschema -------------------------------------------------------------

const { theme, setTheme } = useTheme();

function onThemeChange(value: AcceptableValue | AcceptableValue[]) {
    if (value === 'light' || value === 'dark' || value === 'system') {
        setTheme(value);
    }
}

// --- Palette ----------------------------------------------------------------

interface Swatch {
    label: string;
    token: string;
    classes: string;
}

const swatches: Swatch[] = [
    { label: 'Hintergrund', token: 'background', classes: 'bg-background text-foreground' },
    { label: 'Karte', token: 'card', classes: 'bg-card text-card-foreground' },
    { label: 'Popover', token: 'popover', classes: 'bg-popover text-popover-foreground' },
    { label: 'Primär', token: 'primary', classes: 'bg-primary text-primary-foreground' },
    { label: 'Sekundär', token: 'secondary', classes: 'bg-secondary text-secondary-foreground' },
    { label: 'Gedämpft', token: 'muted', classes: 'bg-muted text-muted-foreground' },
    { label: 'Akzent', token: 'accent', classes: 'bg-accent text-accent-foreground' },
    {
        label: 'Destruktiv',
        token: 'destructive',
        classes: 'bg-destructive text-destructive-foreground',
    },
    { label: 'Linie', token: 'border', classes: 'bg-border text-foreground' },
    { label: 'Gold', token: 'gold', classes: 'bg-background text-gold' },
];

// --- Liedliste --------------------------------------------------------------

interface SongRow {
    number: number;
    title: string;
}

const songs: SongRow[] = [
    { number: 142, title: 'Großer Gott, wir loben dich' },
    { number: 165, title: 'Lobe den Herren, den mächtigen König der Ehren' },
    { number: 231, title: 'Nun danket alle Gott' },
    { number: 302, title: 'Die güldne Sonne' },
    { number: 368, title: 'Der Mond ist aufgegangen' },
];

// --- Formularelemente -------------------------------------------------------

const playlistName = ref('');
const category = ref<AcceptableValue>('lob');
const showSheetMusic = ref(true);
const onlyFavorites = ref<boolean | 'indeterminate'>(false);
const textSize = ref<number[] | undefined>([17]);
const numberRange = ref<number[] | undefined>([120, 320]);
const notesFilter = ref<AcceptableValue | AcceptableValue[]>('alle');

const textSizeLabel = computed(() => `${textSize.value?.[0] ?? 17} pt`);
const numberRangeLabel = computed(() => {
    const [from, to] = numberRange.value ?? [120, 320];
    return `${from} – ${to}`;
});

// --- Overlays ---------------------------------------------------------------

const dialogPlaylistName = ref('Adventssingen');

const notation = ref<AcceptableValue>('noten');
const autoScroll = ref(false);
const zoom = ref<number[] | undefined>([100]);
const zoomLabel = computed(() => `${zoom.value?.[0] ?? 100} %`);

const { confirm } = useConfirm();

async function demoConfirm() {
    const ok = await confirm({
        title: 'Playlist veröffentlichen?',
        message: 'Die Playlist wird anschließend für alle Mitglieder sichtbar.',
        confirmText: 'Veröffentlichen',
    });
    toast(ok ? 'Playlist veröffentlicht.' : 'Vorgang abgebrochen.');
}

async function demoConfirmDestructive() {
    const ok = await confirm({
        title: 'Lied wirklich löschen?',
        message: 'Dieser Schritt kann nicht rückgängig gemacht werden.',
        confirmText: 'Löschen',
        destructive: true,
    });
    toast(ok ? 'Lied gelöscht.' : 'Vorgang abgebrochen.');
}

const actionSheetOpen = ref(false);

const sheetActions: ActionSheetAction[] = [
    {
        label: 'Zur Playlist hinzufügen',
        icon: ListPlus,
        handler: () => toast('Zur Playlist hinzugefügt.'),
    },
    { label: 'Teilen', icon: Share2, handler: () => toast('Freigabe geöffnet.') },
    { label: 'Herunterladen', icon: Download, handler: () => toast('Download gestartet.') },
    {
        label: 'Aus der Playlist entfernen',
        icon: Trash2,
        role: 'destructive',
        handler: () => toast('Lied entfernt.'),
    },
    { label: 'Abbrechen', role: 'cancel' },
];

function demoToast() {
    toast('Änderungen wurden gespeichert.');
}

function demoToastWithAction() {
    toast('Lied aus der Playlist entfernt.', {
        action: {
            label: 'Rückgängig',
            onClick: () => toast('Lied wiederhergestellt.'),
        },
    });
}

// --- Status -----------------------------------------------------------------

const progressValue = ref(0.25);
const progressPercent = computed(() => Math.round(progressValue.value * 100));
let progressTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    progressTimer = setInterval(() => {
        progressValue.value =
            progressValue.value >= 1 ? 0 : Math.min(1, progressValue.value + 0.25);
    }, 1200);
});

onUnmounted(() => {
    clearInterval(progressTimer);
});
</script>

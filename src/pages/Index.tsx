import { Languages, SpellCheck, ArrowRightLeft, Mic } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpellCheckTab } from "@/components/SpellCheckTab";
import { TranslationTab } from "@/components/TranslationTab";
import { AudioTab } from "@/components/AudioTab";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Languages className="h-10 w-10 text-primary-foreground" />
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-primary-foreground">
              LinguaTech
            </h1>
          </div>
          <p className="text-primary-foreground/80 text-lg font-body max-w-xl mx-auto">
            Emeli aň bilen türkmen diliniň orfografiýasyny barlaň, terjime ediň we sesi seljerň.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <Tabs defaultValue="spellcheck" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="spellcheck" className="gap-2 font-heading text-sm">
              <SpellCheck className="h-4 w-4" />
              Orfografiýa
            </TabsTrigger>
            <TabsTrigger value="translate" className="gap-2 font-heading text-sm">
              <ArrowRightLeft className="h-4 w-4" />
              Terjime
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-2 font-heading text-sm">
              <Mic className="h-4 w-4" />
              Ses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spellcheck">
            <SpellCheckTab />
          </TabsContent>

          <TabsContent value="translate">
            <TranslationTab />
          </TabsContent>

          <TabsContent value="audio">
            <AudioTab />
          </TabsContent>
        </Tabs>

        <div className="text-center text-xs text-muted-foreground py-6 space-y-1">
          <p>Lovable AI esasynda işleýär · Türkmen bazary üçin döredildi</p>
          <p>Bu gural emeli aňa esaslanýan çaklama berýär.</p>
        </div>
      </main>
    </div>
  );
}

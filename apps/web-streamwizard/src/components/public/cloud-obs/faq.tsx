import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui";

/*
 * The questions people ask in Discord before they ask for access. Answers stay
 * concrete: what the product does today, no roadmap promises.
 */
const FAQ = [
  {
    question: "Do I need a PC for this?",
    answer:
      "For the first setup, yes. Building scenes and arranging sources is a job for a real screen and a mouse. After that you never need it again: your phone is the camera and the encoder, OBS runs on our side, and the deck on your phone is the only control you take outside.",
  },
  {
    question: "What do I stream from?",
    answer:
      "An Android phone with IRL Pro, or a bonding encoder like Belabox, Moblin or IRLToolkit. Anything that can send SRT or SRTLA to an address works.",
  },
  {
    question: "What happens when my connection drops?",
    answer:
      "The auto switcher moves to your low-bitrate scene, then to connection-lost if the feed dies, and back once it is genuinely stable. Your Twitch stream stays up the whole time. On a long outage it can end the stream for you instead.",
  },
  {
    question: "Do my scenes survive when I stop the OBS?",
    answer:
      "Yes. Scenes, sources, settings and uploaded files come back exactly as you left them. Stop it between streams, nothing is lost.",
  },
  {
    question: "What happens to my scenes when I change tier?",
    answer:
      "Nothing. Only the output resolution and frame rate change to match the new tier.",
  },
  {
    question: "Can I use my existing alerts and overlays?",
    answer:
      "It is real OBS, so any browser source you already use drops straight in. The guided setup asks for your alert URLs and puts them on the scenes you pick.",
  },
  {
    question: "Is ingest a separate product?",
    answer:
      "No. Bonded SRT/SRTLA ingest is part of every Cloud OBS plan, key rotation included. There is nothing extra to buy.",
  },
  {
    question: "What if my stream key leaks?",
    answer:
      "Rotate it in one click. The old key stops working immediately, and you paste the new one into your phone.",
  },
];

export function CloudObsFaq() {
  return (
    <Accordion type="single" collapsible className="max-w-3xl">
      {FAQ.map(({ question, answer }) => (
        <AccordionItem key={question} value={question}>
          <AccordionTrigger className="text-base">{question}</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">{answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

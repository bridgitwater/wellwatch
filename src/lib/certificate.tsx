import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { fmtDate, fmtInt, countryName } from "./format";
import type { StageRow, Well } from "./types";

const s = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica", color: "#16232B", backgroundColor: "#FFFFFF" },
  rule: { height: 3, backgroundColor: "#17607D", marginBottom: 28 },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: "#51666F", textTransform: "uppercase", marginBottom: 8 },
  title: { fontSize: 30, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  sub: { fontSize: 13, color: "#51666F", marginBottom: 32, lineHeight: 1.4 },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0F4A62", marginBottom: 4 },
  body: { fontSize: 12, lineHeight: 1.6, marginBottom: 20 },
  dedication: { fontSize: 13, fontFamily: "Helvetica-Oblique", color: "#0F4A62", marginBottom: 24, padding: 14, backgroundColor: "#DCEBF1", borderRadius: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 28 },
  cell: { width: "33%", marginBottom: 14 },
  k: { fontSize: 9, color: "#66787F", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  v: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", left: 56, right: 56, bottom: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 9, color: "#66787F" },
});

export type CertificateInput = {
  well: Well;
  stages: StageRow[];
  funderName: string;
  cofunders: number;
};

export function Certificate({ well, stages, funderName, cofunders }: CertificateInput) {
  const handover = stages.find((x) => x.stage === "handover")?.reached_at;
  const others = Math.max(cofunders - 1, 0);
  return (
    <Document title={`WellWatch certificate · ${well.code}`} author="BridgIT Water Foundation">
      <Page size="A4" style={s.page}>
        <View style={s.rule} />
        <Text style={s.eyebrow}>BridgIT Water Foundation · Certificate of completion</Text>
        <Text style={s.title}>Clean water for {well.name}</Text>
        <Text style={s.sub}>
          {[well.village, well.region, countryName(well.country)].filter(Boolean).join(", ")} · Well {well.code}
        </Text>

        <Text style={s.eyebrow}>Made possible by</Text>
        <Text style={s.name}>{funderName}</Text>
        {others > 0 && <Text style={{ fontSize: 11, color: "#51666F", marginBottom: 14 }}>together with {others} other funder{others === 1 ? "" : "s"}</Text>}
        {others === 0 && <View style={{ marginBottom: 14 }} />}

        <Text style={s.body}>
          This certifies that the well at {well.name} was completed and handed over to the community
          {handover ? ` on ${fmtDate(handover)}` : ""}. A trained local water committee now owns and maintains the well,
          and our local partner stays in touch with the community.
        </Text>

        {well.dedication && <Text style={s.dedication}>{well.dedication}</Text>}

        <View style={s.grid}>
          <View style={s.cell}><Text style={s.k}>People served</Text><Text style={s.v}>{fmtInt(well.people_served)}</Text></View>
          <View style={s.cell}><Text style={s.k}>Water source</Text><Text style={s.v}>{well.source_type ?? "Borehole"}</Text></View>
          <View style={s.cell}><Text style={s.k}>Completed</Text><Text style={s.v}>{handover ? fmtDate(handover) : "—"}</Text></View>
          <View style={s.cell}><Text style={s.k}>Depth</Text><Text style={s.v}>{well.depth_m ? `${Number(well.depth_m)} m` : "—"}</Text></View>
          <View style={s.cell}><Text style={s.k}>Yield</Text><Text style={s.v}>{well.yield_lph ? `${fmtInt(well.yield_lph)} L/hour` : "—"}</Text></View>
          <View style={s.cell}><Text style={s.k}>Country</Text><Text style={s.v}>{countryName(well.country)}</Text></View>
        </View>

        <View style={s.footer}>
          <Text>BridgIT Water Foundation · Australian Charity CH1853 · bridgitwater.org</Text>
          <Text>Completed {handover ? fmtDate(handover) : well.completed_at ? fmtDate(well.completed_at) : fmtDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificate(input: CertificateInput): Promise<Buffer> {
  return renderToBuffer(<Certificate {...input} />);
}

/** A printable name: the sponsor line if the admin set one, else a real display name, else a warm generic. */
export function certificateName(displayName: string | null, email: string, sponsorLine: string | null): string {
  if (sponsorLine) return sponsorLine;
  const local = email.split("@")[0].toLowerCase();
  if (displayName && displayName.trim() && displayName.trim().toLowerCase() !== local) return displayName.trim();
  return "A generous supporter";
}

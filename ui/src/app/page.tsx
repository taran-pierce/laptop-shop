"use client";

import { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

interface SpecItem {
  rank: string;
  title: string;
  price: string;
  store: string;
  gpu: string;
  ram: string;
  storage: string;
  cpu: string;
  screen: string;
  link: string;
}

interface DealItem {
  title: string;
  price: string;
  store: string;
  gpu: string;
  ram: string;
  storage: string;
  cpu: string;
  screen: string;
  link: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function Home() {
  const [tabValue, setTabValue] = useState(0);
  const [specs, setSpecs] = useState<Record<string, SpecItem[]>>({
    scar: [],
    g18: [],
  });
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch both products
      const [scarRes, g18Res, dealsRes] = await Promise.all([
        fetch("/api/specs?product=scar"),
        fetch("/api/specs?product=g18"),
        fetch("/api/deals"),
      ]);

      if (!scarRes.ok || !g18Res.ok || !dealsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const scarData = await scarRes.json();
      const g18Data = await g18Res.json();
      const dealsData = await dealsRes.json();

      setSpecs({
        scar: scarData.data || [],
        g18: g18Data.data || [],
      });
      setDeals(dealsData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }} elevation={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <div>
            <Typography variant="h4" component="h1" gutterBottom>
              Laptop Price Tracker
            </Typography>
            <Typography color="text.secondary">
              Real-time specs and deals from major retailers
            </Typography>
          </div>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && (
        <Paper>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="dashboard tabs"
          >
            <Tab label="SCAR 18 Specs" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="G18 Specs" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="Deals" id="tab-2" aria-controls="tabpanel-2" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <SpecsTable data={specs.scar} productName="SCAR 18" />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <SpecsTable data={specs.g18} productName="G18" />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <DealsTable data={deals} />
          </TabPanel>
        </Paper>
      )}
    </Container>
  );
}

function SpecsTable({
  data,
  productName,
}: {
  data: SpecItem[];
  productName: string;
}) {
  if (data.length === 0) {
    return (
      <Alert severity="info">No {productName} specs found. Run the scraper.</Alert>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
            <TableCell sx={{ fontWeight: "bold" }}>Rank</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Title</TableCell>
            <TableCell sx={{ fontWeight: "bold" }} align="right">
              Price
            </TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Store</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>GPU</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>RAM</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Storage</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>CPU</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Screen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx} hover>
              <TableCell>{row.rank}</TableCell>
              <TableCell>
                <a href={row.link} target="_blank" rel="noopener noreferrer">
                  {row.title}
                </a>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                {row.price}
              </TableCell>
              <TableCell>{row.store}</TableCell>
              <TableCell>{row.gpu || "—"}</TableCell>
              <TableCell>{row.ram || "—"}</TableCell>
              <TableCell>{row.storage || "—"}</TableCell>
              <TableCell>{row.cpu || "—"}</TableCell>
              <TableCell>{row.screen || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DealsTable({ data }: { data: DealItem[] }) {
  if (data.length === 0) {
    return (
      <Alert severity="info">
        No deals found yet. Check back soon!
      </Alert>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
            <TableCell sx={{ fontWeight: "bold" }}>Title</TableCell>
            <TableCell sx={{ fontWeight: "bold" }} align="right">
              Price
            </TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Store</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>GPU</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>RAM</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Storage</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>CPU</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Screen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx} hover>
              <TableCell>
                <a href={row.link} target="_blank" rel="noopener noreferrer">
                  {row.title}
                </a>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold", color: "#d32f2f" }}>
                {row.price}
              </TableCell>
              <TableCell>{row.store}</TableCell>
              <TableCell>{row.gpu || "—"}</TableCell>
              <TableCell>{row.ram || "—"}</TableCell>
              <TableCell>{row.storage || "—"}</TableCell>
              <TableCell>{row.cpu || "—"}</TableCell>
              <TableCell>{row.screen || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}



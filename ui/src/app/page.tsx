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
  AppBar,
  Toolbar,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Link from "next/link";

interface SpecItem {
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
  // Start with the same default as server render to avoid hydration mismatch.
  const [searchTerms, setSearchTerms] = useState<string[]>(["All Specs"]);
  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [specsRes, configRes, dealsRes] = await Promise.all([
        fetch("/api/specs?product=all"),
        fetch("/api/config"),
        fetch("/api/deals"),
      ]);

      if (!specsRes.ok || !configRes.ok || !dealsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const specsData = await specsRes.json();
      const configData = await configRes.json();
      const dealsData = await dealsRes.json();

      const terms =
        Array.isArray(configData.searchTerms) && configData.searchTerms.length
          ? configData.searchTerms
          : ["All Specs"];

      setSearchTerms(terms);
      setSpecs(specsData.data || []);
      setDeals(dealsData.data || []);

      // Keep tab index valid when terms list changes
      setTabValue((current) => Math.min(current, terms.length));
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
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Laptop Tracker
          </Typography>
          <Button color="inherit" component={Link} href="/">
            Dashboard
          </Button>
          <Button color="inherit" component={Link} href="/config">
            Configure
          </Button>
        </Toolbar>
      </AppBar>
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
            {(searchTerms.length ? searchTerms : ["All Specs"]).map((term, idx) => (
              <Tab
                key={term}
                label={term}
                id={`tab-${idx}`}
                aria-controls={`tabpanel-${idx}`}
              />
            ))}
            <Tab
              key="deals"
              label="Deals"
              id={`tab-${searchTerms.length}`}
              aria-controls={`tabpanel-${searchTerms.length}`}
            />
          </Tabs>

          {(searchTerms.length ? searchTerms : ["All Specs"]).map((term, idx) => {
            const filteredSpecs = specs.filter((row) =>
              term === "All Specs"
                ? true
                : row.title.toLowerCase().includes(term.toLowerCase())
            );
            return (
              <TabPanel value={tabValue} index={idx} key={term}>
                <SpecsTable data={filteredSpecs} productName={term} />
              </TabPanel>
            );
          })}

          <TabPanel value={tabValue} index={searchTerms.length}>
            <DealsTable data={deals} />
          </TabPanel>
        </Paper>
      )}
      </Container>
    </>
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
              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                {row.price}
              </TableCell>
              <TableCell>
                <a href={row.link} target="_blank" rel="noopener noreferrer">
                  {row.store}
                </a>
              </TableCell>
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
              <TableCell>
                <a href={row.link} target="_blank" rel="noopener noreferrer">
                  {row.store}
                </a>
              </TableCell>
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



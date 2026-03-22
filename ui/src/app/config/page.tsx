"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  AppBar,
  Toolbar,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import Link from "next/link";

interface ScraperConfig {
  searchTerms: string[];
  priceTargets: Record<string, number>;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ScraperConfig>({
    searchTerms: [],
    priceTargets: {},
  });
  const [newTerm, setNewTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeStreamActive, setScrapeStreamActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scraperOutput, setScraperOutput] = useState("");

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Failed to load config");
        const data = await res.json();
        setConfig(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const addSearchTerm = () => {
    if (newTerm.trim()) {
      setConfig((prev) => ({
        ...prev,
        searchTerms: [...prev.searchTerms, newTerm.trim()],
        priceTargets: {
          ...prev.priceTargets,
          [newTerm.trim()]: prev.priceTargets[newTerm.trim()] || 0,
        },
      }));
      setNewTerm("");
    }
  };

  const removeSearchTerm = (index: number) => {
    setConfig((prev) => {
      const termToRemove = prev.searchTerms[index];
      const nextPriceTargets = { ...prev.priceTargets };
      delete nextPriceTargets[termToRemove];
      return {
        ...prev,
        searchTerms: prev.searchTerms.filter((_, i) => i !== index),
        priceTargets: nextPriceTargets,
      };
    });
  };

  const updatePriceTarget = (term: string, value: number) => {
    setConfig((prev) => ({
      ...prev,
      priceTargets: { ...prev.priceTargets, [term]: value },
    }));
  };

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to save config");

      setSuccess("Config saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const runScraper = async () => {
    setScraping(true);
    setScraperOutput(
      "Starting scraper... this may take 2-10 minutes depending on network and site response times.\n\n"
    );
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json();

      if (!data.success) {
        setScraperOutput((prev) => prev + `\n[ERROR] ${data.error || data.message}`);
        throw new Error(data.error || data.message);
      }

      setScraperOutput((prev) => prev + `\n${data.output}`);
      setScraperOutput(
        (prev) =>
          prev +
          `\n\n✅ Scraper completed successfully!\n[INFO] CSV files updated in csv_output/\n[INFO] Refresh the dashboard to see new data.`
      );
      setSuccess("Scraper completed! Check the dashboard for new data.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setScraperOutput((prev) => prev + `\n[FATAL ERROR] ${err}`);
    } finally {
      setScraping(false);
      setScrapeStreamActive(false);
    }
  };

  const runScraperStream = () => {
    if (scrapeStreamActive) return;

    setScraping(true);
    setScrapeStreamActive(true);
    setScraperOutput(
      "Streaming scraper output... this may take 2-10 minutes.\n\n"
    );
    setError(null);
    setSuccess(null);

    const eventSource = new EventSource("/api/scrape-stream");

    eventSource.onmessage = (event) => {
      setScraperOutput((prev) => prev + event.data + "\n");
    };

    eventSource.addEventListener("done", () => {
      setScraperOutput((prev) => prev + "\n✅ Scraper completed (stream).\n");
      setSuccess("Scraper completed via stream! Refresh dashboard to see new data.");
      setTimeout(() => setSuccess(null), 5000);
      setScraping(false);
      setScrapeStreamActive(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setError("Stream connection error, please try again.");
      setScraping(false);
      setScrapeStreamActive(false);
      eventSource.close();
    };
  };

  if (loading) {
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
        <Container maxWidth="lg" sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Container>
      </>
    );
  }

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
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }} elevation={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Scraper Configuration
        </Typography>
        <Typography color="text.secondary">
          Manage search terms and trigger new scrape runs
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Stack spacing={3}>
        {/* Search Terms Section */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold" }}>
              Search Terms
            </Typography>
            <List>
              {config.searchTerms.map((term, idx) => (
                <ListItem
                  key={idx}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => removeSearchTerm(idx)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText primary={term} />
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="Enter search term..."
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") addSearchTerm();
                }}
                fullWidth
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={addSearchTerm}
              >
                Add
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Price Targets Section */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold" }}>
              Price Targets (Deal Thresholds)
            </Typography>

            <Stack spacing={2}>
              {config.searchTerms.map((term) => (
                <TextField
                  key={term}
                  label={`${term} Target Price ($)`}
                  type="number"
                  value={config.priceTargets[term] ?? 0}
                  onChange={(e) =>
                    updatePriceTarget(term, parseInt(e.target.value) || 0)
                  }
                  fullWidth
                />
              ))}
              {config.searchTerms.length === 0 && (
                <Typography color="text.secondary">
                  Add search terms to set targets.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Actions */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="success"
            startIcon={<SaveIcon />}
            onClick={saveConfig}
            disabled={saving}
            size="large"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={runScraper}
            disabled={scraping}
            size="large"
          >
            {scraping && !scrapeStreamActive ? "Scraping..." : "Run Scraper Now"}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PlayArrowIcon />}
            onClick={runScraperStream}
            disabled={scraping}
            size="large"
          >
            {scraping && scrapeStreamActive ? "Streaming..." : "Run Scraper (Stream)"}
          </Button>
        </Stack>

        {/* Scraper Output */}
        {(scraperOutput || scraping) && (
          <Card sx={{ backgroundColor: "#f5f5f5" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: "bold", flexGrow: 1 }}>
                  Scraper Output
                </Typography>
                {scraping && <CircularProgress size={24} />}
                {scraping && (
                  <Typography variant="body2" color="info.main">
                    Running...
                  </Typography>
                )}
              </Stack>
              <Box
                component="pre"
                sx={{
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  maxHeight: "500px",
                  overflowY: "auto",
                  padding: 1.5,
                  backgroundColor: "#000",
                  color: "#0f0",
                  border: "1px solid #333",
                  borderRadius: 1,
                }}
              >
                {scraperOutput}
              </Box>
            </CardContent>
          </Card>
        )}
      </Stack>
      </Container>
    </>
  );
}

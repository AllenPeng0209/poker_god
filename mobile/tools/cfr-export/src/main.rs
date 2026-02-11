use bincode::deserialize;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::env;
use std::fs;
use std::path::Path;

type PublicInfoSet = Vec<u8>;
type OutputType = (HashMap<PublicInfoSet, Vec<Vec<Vec<f64>>>>, f64, f64);

#[derive(Serialize)]
struct ExportMeta {
    source: String,
    license: String,
    stack_bb: Option<f64>,
    iterations: Option<usize>,
    ev_sb_bb: f64,
    exploitability_bb: f64,
    scale: String,
}

#[derive(Serialize)]
struct StateEntry {
    num_actions: usize,
    probs_bp: Vec<Vec<Vec<u16>>>,
}

#[derive(Serialize)]
struct ExportModel {
    meta: ExportMeta,
    states: BTreeMap<String, StateEntry>,
}

fn parse_stack_and_iterations(path: &Path) -> (Option<f64>, Option<usize>) {
    let Some(stem) = path.file_stem().and_then(|x| x.to_str()) else {
        return (None, None);
    };

    let parts = stem.split('-').collect::<Vec<_>>();
    if parts.len() < 3 || parts[0] != "preflop" {
        return (None, None);
    }

    let stack_bb = parts[1].parse::<f64>().ok();
    let iterations = parts[2].parse::<usize>().ok();
    (stack_bb, iterations)
}

fn quantize(prob: f64) -> u16 {
    let scaled = (prob * 10_000.0).round();
    scaled.clamp(0.0, 10_000.0) as u16
}

fn to_state_key(info_set: &PublicInfoSet) -> String {
    if info_set.is_empty() {
        return "root".to_string();
    }
    info_set
        .iter()
        .map(u8::to_string)
        .collect::<Vec<_>>()
        .join("-")
}

fn main() -> Result<(), String> {
    let args = env::args().collect::<Vec<_>>();
    if args.len() != 3 {
        return Err(
            "Usage: cfr-export <input-bin-path> <output-json-path>\nExample: cargo run --release -- ../poker-cfr/output/preflop-20-75000.bin ../../src/solver/data/preflop-20bb.json".to_string(),
        );
    }

    let input_path = Path::new(&args[1]);
    let output_path = Path::new(&args[2]);

    let buf = fs::read(input_path).map_err(|e| format!("Failed to read input: {e}"))?;
    let decoded = deserialize::<OutputType>(&buf).map_err(|e| format!("Failed to decode bincode: {e}"))?;

    let (stack_bb, iterations) = parse_stack_and_iterations(input_path);
    let mut states = BTreeMap::new();

    for (key, action_tensor) in decoded.0 {
        let mut probs_bp = Vec::with_capacity(action_tensor.len());
        for action_matrix in action_tensor {
            let mut rows = Vec::with_capacity(action_matrix.len());
            for row in action_matrix {
                let quantized_row = row.into_iter().map(quantize).collect::<Vec<_>>();
                rows.push(quantized_row);
            }
            probs_bp.push(rows);
        }

        states.insert(
            to_state_key(&key),
            StateEntry {
                num_actions: probs_bp.len(),
                probs_bp,
            },
        );
    }

    let export = ExportModel {
        meta: ExportMeta {
            source: "https://github.com/b-inary/poker-cfr".to_string(),
            license: "BSD-2-Clause".to_string(),
            stack_bb,
            iterations,
            ev_sb_bb: decoded.1,
            exploitability_bb: decoded.2,
            scale: "basis_points_0_to_10000".to_string(),
        },
        states,
    };

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create output directory: {e}"))?;
    }

    let json = serde_json::to_string(&export).map_err(|e| format!("Failed to serialize JSON: {e}"))?;
    fs::write(output_path, json).map_err(|e| format!("Failed to write output: {e}"))?;

    println!(
        "Exported {} states from {} to {}",
        export.states.len(),
        input_path.display(),
        output_path.display()
    );
    Ok(())
}

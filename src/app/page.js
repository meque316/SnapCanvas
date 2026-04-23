"use client";
import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Text, Transformer, Rect, Image as KonvaImage, Line } from "react-konva";
import jsPDF from "jspdf";

export default function Home() {
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [colorValue, setColorValue] = useState("#000000");
  const [guides, setGuides] = useState([]);

  const stageRef = useRef(null);
  const trRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const objectsRef = useRef([]);

  const GUIDELINE_OFFSET = 5;

  // 🔥 focus para detectar teclado
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // 🔥 borrar con teclado (BACKSPACE / DELETE)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedId || editingId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        setElements((prev) => prev.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, editingId]);

  // cache objetos
  useEffect(() => {
    if (!stageRef.current) return;
    objectsRef.current = stageRef.current.find(".object");
  }, [elements]);

  // cargar datos
  useEffect(() => {
    const saved = localStorage.getItem("editor-data");

    if (saved) {
      try {
        setElements(JSON.parse(saved));
      } catch {
        localStorage.removeItem("editor-data");
      }
    }
  }, []);

  // guardar datos
  useEffect(() => {
    localStorage.setItem("editor-data", JSON.stringify(elements));
  }, [elements]);

  // snapping
  const getLineGuideStops = (skipShape) => {
    const stage = stageRef.current;
    const vertical = [0, stage.width() / 2, stage.width()];
    const horizontal = [0, stage.height() / 2, stage.height()];

    objectsRef.current.forEach((guideItem) => {
      if (guideItem === skipShape) return;
      const box = guideItem.getClientRect();

      vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
    });

    return { vertical, horizontal };
  };

  const handleDragMove = (e) => {
    const target = e.target;
    const { vertical, horizontal } = getLineGuideStops(target);
    const box = target.getClientRect();

    let snapX = 0;
    let snapY = 0;
    const newGuides = [];

    vertical.forEach((line) => {
      [box.x, box.x + box.width, box.x + box.width / 2].forEach((point) => {
        if (Math.abs(line - point) < GUIDELINE_OFFSET) {
          snapX = line - point;
          newGuides.push({ x: line, y: 0, orientation: "V" });
        }
      });
    });

    horizontal.forEach((line) => {
      [box.y, box.y + box.height, box.y + box.height / 2].forEach((point) => {
        if (Math.abs(line - point) < GUIDELINE_OFFSET) {
          snapY = line - point;
          newGuides.push({ x: 0, y: line, orientation: "H" });
        }
      });
    });

    target.x(target.x() + snapX);
    target.y(target.y() + snapY);

    setGuides(newGuides);
  };

  const handleTransformEnd = (node, id) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;

        return el.type === "text"
          ? { ...el, x: node.x(), y: node.y(), fontSize: el.fontSize * scaleX }
          : {
              ...el,
              x: node.x(),
              y: node.y(),
              width: el.width * scaleX,
              height: el.height * scaleY,
            };
      })
    );

    node.scaleX(1);
    node.scaleY(1);
  };

  const downloadPNG = () => {
    setSelectedId(null);
    setGuides([]);

    setTimeout(() => {
      const uri = stageRef.current.toDataURL({ pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = "diseno.png";
      link.href = uri;
      link.click();
    }, 100);
  };

  const exportPDF = () => {
    setSelectedId(null);
    setGuides([]);

    setTimeout(() => {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 3 });
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(dataUrl);

      const ratio = Math.min(
        pageWidth / imgProps.width,
        pageHeight / imgProps.height
      );

      const imgWidth = imgProps.width * ratio;
      const imgHeight = imgProps.height * ratio;

      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      pdf.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight);
      pdf.save("orden-produccion.pdf");
    }, 100);
  };

  const createId = () => crypto.randomUUID();

  const addText = () =>
    setElements([
      ...elements,
      {
        id: createId(),
        type: "text",
        text: "Nuevo Texto",
        x: 100,
        y: 100,
        fontSize: 25,
        color: "#000",
      },
    ]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const img = new window.Image();
      img.src = reader.result;

      img.onload = () => {
        setElements([
          ...elements,
          {
            id: createId(),
            type: "image",
            image: img,
            x: 50,
            y: 50,
            width: img.width / 4,
            height: img.height / 4,
          },
        ]);
      };
    };

    reader.readAsDataURL(file);
  };

  const moveLayer = (direction) => {
    if (!selectedId) return;

    setElements((prev) => {
      const item = prev.find((el) => el.id === selectedId);
      const filtered = prev.filter((el) => el.id !== selectedId);

      return direction === "front"
        ? [...filtered, item]
        : [item, ...filtered];
    });
  };

  useEffect(() => {
    if (!trRef.current || editingId) return;

    const node = stageRef.current.findOne(`#el-${selectedId}`);

    if (node) {
      trRef.current.nodes([node]);
      trRef.current.getLayer().batchDraw();
    } else {
      trRef.current.nodes([]);
    }
  }, [selectedId, editingId, elements]);

  const currentEditingElement = elements.find((el) => el.id === editingId);

  return (
    <main
      ref={containerRef}
      tabIndex={0}
      className="h-screen flex text-black outline-none"
    >
      <div className="w-1/4 bg-gray-100 p-4 border-r flex flex-col gap-2">
        <h2 className="font-bold text-xl mb-4">Editor</h2>

        <button onClick={addText} className="bg-blue-600 text-white p-2 rounded">
          Añadir Texto
        </button>

        <button onClick={() => fileInputRef.current.click()} className="bg-purple-600 text-white p-2 rounded">
          Subir Imagen
        </button>

        <button onClick={() => moveLayer("front")} className="bg-yellow-500 text-white p-2 rounded">
          Traer al frente
        </button>

        <button onClick={() => moveLayer("back")} className="bg-gray-500 text-white p-2 rounded">
          Enviar atrás
        </button>

        <button onClick={downloadPNG} className="bg-green-600 text-white p-2 rounded">
          Descargar PNG
        </button>

        <button onClick={exportPDF} className="bg-red-600 text-white p-2 rounded">
          Exportar PDF
        </button>

        <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} />
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-300 relative">
        <Stage
          width={500}
          height={500}
          ref={stageRef}
          className="bg-white shadow"
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) {
              setSelectedId(null);
              setEditingId(null);
            }
          }}
          onDblClick={(e) => {
            if (e.target.className === "Text") {
              const id = e.target.id().replace("el-", "");
              const el = elements.find((item) => item.id === id);

              setEditingId(el.id);
              setInputValue(el.text);
              setColorValue(el.color || "#000");
            }
          }}
        >
          <Layer>
            <Rect width={500} height={500} fill="white" />

            {elements.map((el) =>
              el.type === "image" ? (
                <KonvaImage
                  key={el.id}
                  id={`el-${el.id}`}
                  name="object"
                  image={el.image}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  draggable
                  onDragMove={handleDragMove}
                  onDragEnd={() => setGuides([])}
                  onClick={() => setSelectedId(el.id)}
                  onTransformEnd={(e) => handleTransformEnd(e.target, el.id)}
                />
              ) : (
                <Text
                  key={el.id}
                  id={`el-${el.id}`}
                  name="object"
                  text={el.text}
                  x={el.x}
                  y={el.y}
                  fontSize={el.fontSize}
                  fill={el.color}
                  draggable={!editingId}
                  onDragMove={handleDragMove}
                  onDragEnd={() => setGuides([])}
                  onClick={() => setSelectedId(el.id)}
                  onTransformEnd={(e) => handleTransformEnd(e.target, el.id)}
                />
              )
            )}

            {guides.map((g, i) => (
              <Line
                key={i}
                points={g.orientation === "V" ? [g.x, 0, g.x, 500] : [0, g.y, 500, g.y]}
                stroke="#ff00ff"
                dash={[4, 4]}
              />
            ))}

            {selectedId && !editingId && <Transformer ref={trRef} />}
          </Layer>
        </Stage>

        {currentEditingElement && (
          <div
            className="absolute bg-white border p-2 flex gap-2"
            style={{
              top: Math.max(10, currentEditingElement.y - 50),
              left: Math.max(10, currentEditingElement.x),
            }}
          >
            <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
            <input type="color" value={colorValue} onChange={(e) => setColorValue(e.target.value)} />
            <button
              onClick={() => {
                setElements((prev) =>
                  prev.map((el) =>
                    el.id === editingId
                      ? { ...el, text: inputValue, color: colorValue }
                      : el
                  )
                );
                setEditingId(null);
              }}
            >
              OK
            </button>
          </div>
        )}
      </div>
    </main>
  );
}